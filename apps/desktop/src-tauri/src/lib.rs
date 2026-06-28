use std::env;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime};

use otobun_core::{
    export_transcript, sample_transcript, transcribe_file_with_progress, ChunkMode, ExportFormat,
    TranscribeOptions,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

const MODEL_BASE_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportSampleRequest {
    format: String,
    output_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TranscribeRequest {
    input: String,
    model: String,
    format: String,
    title: Option<String>,
    language: Option<String>,
    ffmpeg_bin: Option<String>,
    whisper_bin: Option<String>,
    keep_temp: bool,
    output_path: Option<String>,
    chunk_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelFileRequest {
    id: String,
    file_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaPreviewRequest {
    path: String,
    ffmpeg_bin: Option<String>,
    bar_count: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandResponse {
    output: String,
    wrote_to: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelFileResponse {
    id: String,
    file_name: String,
    path: String,
    size_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaPreviewResponse {
    duration_ms: u64,
    peaks: Vec<f32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelDownloadProgress {
    model_id: String,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    percent: Option<f64>,
    state: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineStatus {
    available: bool,
    binary_path: Option<String>,
    version: Option<String>,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TranscribeProgressEvent {
    stage: String,
    message: String,
    percent: Option<f64>,
}

#[tauri::command]
fn export_sample(request: ExportSampleRequest) -> Result<CommandResponse, String> {
    let format = parse_format(&request.format)?;
    let output =
        export_transcript(&sample_transcript(), format).map_err(|error| error.to_string())?;
    write_optional_output(output, request.output_path)
}

#[tauri::command]
async fn get_media_preview(request: MediaPreviewRequest) -> Result<MediaPreviewResponse, String> {
    tauri::async_runtime::spawn_blocking(move || media_preview_blocking(request))
        .await
        .map_err(|error| format!("media preview task failed: {error}"))?
}

fn media_preview_blocking(request: MediaPreviewRequest) -> Result<MediaPreviewResponse, String> {
    let input_path = PathBuf::from(request.path.trim());
    if !input_path.exists() {
        return Err(format!(
            "media file does not exist: {}",
            input_path.display()
        ));
    }

    let ffmpeg_bin = request
        .ffmpeg_bin
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "ffmpeg".to_string());
    let bar_count = request.bar_count.unwrap_or(64).clamp(24, 120);
    let sample_rate = 8_000_u64;

    let output = Command::new(ffmpeg_bin)
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-i")
        .arg(&input_path)
        .arg("-vn")
        .arg("-ac")
        .arg("1")
        .arg("-ar")
        .arg(sample_rate.to_string())
        .arg("-f")
        .arg("s16le")
        .arg("-")
        .output()
        .map_err(|error| format!("failed to run ffmpeg for media preview: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "ffmpeg media preview failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let sample_count = output.stdout.len() / 2;
    let duration_ms = ((sample_count as u64) * 1000) / sample_rate;
    if sample_count == 0 {
        return Ok(MediaPreviewResponse {
            duration_ms: 0,
            peaks: vec![0.0; bar_count],
        });
    }

    let samples_per_bar = sample_count.div_ceil(bar_count).max(1);
    let mut peaks = Vec::with_capacity(bar_count);

    for bar_index in 0..bar_count {
        let start_sample = bar_index * samples_per_bar;
        if start_sample >= sample_count {
            peaks.push(0.0);
            continue;
        }
        let end_sample = ((bar_index + 1) * samples_per_bar).min(sample_count);
        let mut peak = 0.0_f32;
        for sample_index in start_sample..end_sample {
            let byte_index = sample_index * 2;
            let sample =
                i16::from_le_bytes([output.stdout[byte_index], output.stdout[byte_index + 1]]);
            peak = peak.max(sample.unsigned_abs() as f32 / i16::MAX as f32);
        }
        peaks.push(peak.clamp(0.0, 1.0));
    }

    Ok(MediaPreviewResponse { duration_ms, peaks })
}

#[tauri::command]
async fn transcribe(app: AppHandle, request: TranscribeRequest) -> Result<CommandResponse, String> {
    tauri::async_runtime::spawn_blocking(move || transcribe_blocking(app, request))
        .await
        .map_err(|error| format!("transcribe task failed: {error}"))?
}

fn transcribe_blocking(
    app: AppHandle,
    request: TranscribeRequest,
) -> Result<CommandResponse, String> {
    let format = parse_format(&request.format)?;
    let mut options = TranscribeOptions::new(request.input, request.model);
    options.title = request.title;
    options.language = request.language;
    options.keep_temp = request.keep_temp;
    options.chunk_mode = parse_chunk_mode(request.chunk_mode.as_deref());

    if let Some(ffmpeg_bin) = request.ffmpeg_bin.filter(|value| !value.trim().is_empty()) {
        options.ffmpeg_bin = PathBuf::from(ffmpeg_bin);
    }
    options.whisper_bin = resolve_whisper_binary(request.whisper_bin.as_deref())?;

    emit_transcribe_progress(&app, "queued", "Starting transcription", Some(1.0));
    let transcript = transcribe_file_with_progress(&options, |progress| {
        emit_transcribe_progress(&app, progress.stage, progress.message, progress.percent);
    })
    .map_err(|error| error.to_string())?;
    emit_transcribe_progress(&app, "exporting", "Writing transcript output", Some(98.0));
    let output = export_transcript(&transcript, format).map_err(|error| error.to_string())?;
    let response = write_optional_output(output, request.output_path)?;
    emit_transcribe_progress(&app, "done", "Transcript ready", Some(100.0));
    Ok(response)
}

#[tauri::command]
fn get_engine_status() -> EngineStatus {
    let binary_path = find_whisper_binary();
    let version = binary_path.as_deref().and_then(probe_whisper);
    let available = binary_path.is_some();
    let message = if available {
        "Engine Ready · whisper.cpp local".to_string()
    } else {
        "Missing whisper-cli. Install whisper.cpp or set MAHIRO_WHISPER_CLI.".to_string()
    };

    EngineStatus {
        available,
        binary_path,
        version,
        message,
    }
}

#[tauri::command]
fn list_models(
    app: AppHandle,
    requests: Vec<ModelFileRequest>,
) -> Result<Vec<ModelFileResponse>, String> {
    let models_dir = app_models_dir(&app)?;
    requests
        .into_iter()
        .filter_map(
            |request| match model_response_if_installed(&models_dir, request) {
                Ok(response) => response,
                Err(error) => Some(Err(error)),
            },
        )
        .collect()
}

#[tauri::command]
async fn download_model(
    app: AppHandle,
    request: ModelFileRequest,
) -> Result<ModelFileResponse, String> {
    tauri::async_runtime::spawn_blocking(move || download_model_blocking(app, request))
        .await
        .map_err(|error| format!("download task failed: {error}"))?
}

fn download_model_blocking(
    app: AppHandle,
    request: ModelFileRequest,
) -> Result<ModelFileResponse, String> {
    let models_dir = app_models_dir(&app)?;
    fs::create_dir_all(&models_dir).map_err(|error| {
        format!(
            "failed to create model directory {}: {error}",
            models_dir.display()
        )
    })?;

    let file_name = sanitize_model_file_name(&request.file_name)?;
    let output_path = models_dir.join(&file_name);

    if output_path.exists() {
        return model_response(&request.id, &file_name, &output_path);
    }

    let temp_path = output_path.with_extension("part");
    let url = format!("{MODEL_BASE_URL}/{file_name}");
    emit_model_download_progress(&app, &request.id, 0, None, "starting");

    let mut response = reqwest::blocking::get(&url)
        .map_err(|error| format!("failed to start model download: {error}"))?
        .error_for_status()
        .map_err(|error| format!("model download failed: {error}"))?;
    let total_bytes = response.content_length();

    let mut file = fs::File::create(&temp_path).map_err(|error| {
        format!(
            "failed to create partial model file {}: {error}",
            temp_path.display()
        )
    })?;
    let mut buffer = [0_u8; 1024 * 128];
    let mut downloaded_bytes = 0_u64;
    let mut last_emit = 0_u64;

    loop {
        let read = response
            .read(&mut buffer)
            .map_err(|error| format!("failed while downloading model: {error}"))?;
        if read == 0 {
            break;
        }

        file.write_all(&buffer[..read]).map_err(|error| {
            format!(
                "failed to write model file {}: {error}",
                temp_path.display()
            )
        })?;
        downloaded_bytes += read as u64;

        if downloaded_bytes.saturating_sub(last_emit) >= 1024 * 512 {
            emit_model_download_progress(
                &app,
                &request.id,
                downloaded_bytes,
                total_bytes,
                "downloading",
            );
            last_emit = downloaded_bytes;
        }
    }

    file.flush().map_err(|error| {
        format!(
            "failed to flush model file {}: {error}",
            temp_path.display()
        )
    })?;
    drop(file);

    emit_model_download_progress(
        &app,
        &request.id,
        downloaded_bytes,
        total_bytes,
        "finishing",
    );
    fs::rename(&temp_path, &output_path).map_err(|error| {
        format!(
            "failed to finalize model file {} -> {}: {error}",
            temp_path.display(),
            output_path.display()
        )
    })?;
    emit_model_download_progress(&app, &request.id, downloaded_bytes, total_bytes, "done");

    model_response(&request.id, &file_name, &output_path)
}

#[tauri::command]
fn uninstall_model(app: AppHandle, request: ModelFileRequest) -> Result<(), String> {
    let models_dir = app_models_dir(&app)?;
    let file_name = sanitize_model_file_name(&request.file_name)?;
    let target_path = models_dir.join(&file_name);

    if !target_path.exists() {
        return Ok(());
    }

    let canonical_models_dir = models_dir.canonicalize().map_err(|error| {
        format!(
            "failed to resolve model directory {}: {error}",
            models_dir.display()
        )
    })?;
    let canonical_target = target_path.canonicalize().map_err(|error| {
        format!(
            "failed to resolve model file {}: {error}",
            target_path.display()
        )
    })?;

    if !canonical_target.starts_with(&canonical_models_dir) {
        return Err("refusing to remove a file outside Otobun model storage".to_string());
    }

    fs::remove_file(&canonical_target).map_err(|error| {
        format!(
            "failed to remove model file {}: {error}",
            canonical_target.display()
        )
    })
}

fn emit_transcribe_progress(
    app: &AppHandle,
    stage: &str,
    message: impl Into<String>,
    percent: Option<f64>,
) {
    let _ = app.emit(
        "transcribe-progress",
        TranscribeProgressEvent {
            stage: stage.to_string(),
            message: message.into(),
            percent,
        },
    );
}

fn emit_model_download_progress(
    app: &AppHandle,
    model_id: &str,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    state: &str,
) {
    let percent = total_bytes
        .filter(|total| *total > 0)
        .map(|total| ((downloaded_bytes as f64 / total as f64) * 100.0).clamp(0.0, 100.0));

    let _ = app.emit(
        "model-download-progress",
        ModelDownloadProgress {
            model_id: model_id.to_string(),
            downloaded_bytes,
            total_bytes,
            percent,
            state: state.to_string(),
        },
    );
}

fn model_response_if_installed(
    models_dir: &Path,
    request: ModelFileRequest,
) -> Result<Option<Result<ModelFileResponse, String>>, String> {
    let file_name = sanitize_model_file_name(&request.file_name)?;
    let path = models_dir.join(&file_name);
    if !path.exists() {
        return Ok(None);
    }

    Ok(Some(model_response(&request.id, &file_name, &path)))
}

fn model_response(id: &str, file_name: &str, path: &Path) -> Result<ModelFileResponse, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("failed to read model file {}: {error}", path.display()))?;
    Ok(ModelFileResponse {
        id: id.to_string(),
        file_name: file_name.to_string(),
        path: path.to_string_lossy().to_string(),
        size_bytes: metadata.len(),
    })
}

fn sanitize_model_file_name(file_name: &str) -> Result<String, String> {
    let trimmed = file_name.trim();
    if trimmed.is_empty() {
        return Err("model file name is required".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err("model file name must be a plain file name".to_string());
    }
    if !(trimmed.ends_with(".bin") || trimmed.ends_with(".gguf")) {
        return Err("model file must be .bin or .gguf".to_string());
    }

    Ok(trimmed.to_string())
}

fn app_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("models"))
        .map_err(|error| error.to_string())
}

fn path_exists(path: &str) -> bool {
    Path::new(path).exists()
}

fn command_available(candidate: &str, arg: &str) -> bool {
    Command::new(candidate)
        .arg(arg)
        .output()
        .map(|output| {
            output.status.success() || !output.stdout.is_empty() || !output.stderr.is_empty()
        })
        .unwrap_or(false)
}

fn whisper_candidates() -> Vec<String> {
    let mut candidates = Vec::new();

    if let Ok(path) = env::var("MAHIRO_WHISPER_CLI") {
        candidates.push(path);
    }

    candidates.extend([
        "/opt/homebrew/bin/whisper-cli".to_string(),
        "/usr/local/bin/whisper-cli".to_string(),
        "whisper-cli".to_string(),
    ]);

    candidates
}

fn find_whisper_binary() -> Option<String> {
    whisper_candidates()
        .into_iter()
        .find(|candidate| path_exists(candidate) || command_available(candidate, "--help"))
}

fn resolve_whisper_binary(preferred: Option<&str>) -> Result<PathBuf, String> {
    if let Some(preferred) = preferred
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "whisper-cli")
    {
        if path_exists(preferred) || command_available(preferred, "--help") {
            return Ok(PathBuf::from(preferred));
        }
        return Err(format!("whisper-cli not found at {preferred}"));
    }

    find_whisper_binary().map(PathBuf::from).ok_or_else(|| {
        "Missing whisper-cli. Install whisper.cpp or set MAHIRO_WHISPER_CLI.".to_string()
    })
}

fn probe_whisper(candidate: &str) -> Option<String> {
    let output = Command::new(candidate).arg("--help").output().ok()?;
    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    combined
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(|line| line.trim().to_string())
}

fn parse_chunk_mode(value: Option<&str>) -> ChunkMode {
    match value.map(str::trim).map(str::to_ascii_lowercase).as_deref() {
        Some("smart") => ChunkMode::Smart,
        _ => ChunkMode::Single,
    }
}

fn parse_format(value: &str) -> Result<ExportFormat, String> {
    value
        .parse::<ExportFormat>()
        .map_err(|error| error.to_string())
}

fn write_optional_output(
    output: String,
    output_path: Option<String>,
) -> Result<CommandResponse, String> {
    let Some(path) = output_path.filter(|value| !value.trim().is_empty()) else {
        return Ok(CommandResponse {
            output,
            wrote_to: None,
        });
    };

    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create output directory {}: {error}",
                parent.display()
            )
        })?;
    }

    fs::write(&path, &output)
        .map_err(|error| format!("failed to write output file {path}: {error}"))?;
    Ok(CommandResponse {
        output,
        wrote_to: Some(path),
    })
}

fn cleanup_stale_temp_dirs() {
    const STALE_AFTER: Duration = Duration::from_secs(24 * 60 * 60);

    let Ok(entries) = fs::read_dir(std::env::temp_dir()) else {
        return;
    };
    let now = SystemTime::now();

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !name.starts_with("otobun-") || !path.is_dir() {
            continue;
        }

        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Ok(modified_at) = metadata.modified() else {
            continue;
        };
        let Ok(age) = now.duration_since(modified_at) else {
            continue;
        };
        if age > STALE_AFTER {
            let _ = fs::remove_dir_all(path);
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            cleanup_stale_temp_dirs();
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            export_sample,
            get_media_preview,
            transcribe,
            get_engine_status,
            list_models,
            download_model,
            uninstall_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running Otobun desktop app");
}
