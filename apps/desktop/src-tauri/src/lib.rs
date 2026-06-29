use std::env;
use std::fs;
use std::io::{BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{mpsc, Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant, SystemTime};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SampleFormat;
use hound::{SampleFormat as WavSampleFormat, WavReader, WavSpec, WavWriter};
use otobun_core::{
    export_transcript, sample_transcript, transcribe_file_with_progress, CancellationToken,
    ChunkMode, ExportFormat, TranscribeOptions, TranscribeProgress, Transcript,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

const MODEL_BASE_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

#[derive(Default)]
struct TranscriptionControl {
    current_token: Mutex<Option<CancellationToken>>,
}

#[derive(Default)]
struct RecordingControl {
    active: Mutex<Option<ActiveRecording>>,
}

struct ActiveRecording {
    output_path: PathBuf,
    started_at: Instant,
    stop_tx: mpsc::Sender<()>,
    join_handle: Option<JoinHandle<Result<(), String>>>,
}

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
struct StartRecordingRequest {
    device_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteRecordingRequest {
    path: String,
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

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LibraryEntry {
    id: String,
    title: String,
    source_path: String,
    output_path: String,
    model_label: String,
    model_path: String,
    language: String,
    format: String,
    transcribe_mode: String,
    created_at: String,
    elapsed_ms: Option<u64>,
    duration_ms: Option<u64>,
    segment_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveLibraryEntryRequest {
    entry: LibraryEntry,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LibraryEntryActionRequest {
    id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandResponse {
    output: String,
    wrote_to: Option<String>,
    elapsed_ms: Option<u64>,
    transcript: Option<TranscriptResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TranscriptResponse {
    title: String,
    source: Option<String>,
    language: Option<String>,
    speakers: Vec<SpeakerResponse>,
    segments: Vec<TranscriptSegmentResponse>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SpeakerResponse {
    id: String,
    label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TranscriptSegmentResponse {
    range: TimeRangeResponse,
    speaker_id: Option<String>,
    text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimeRangeResponse {
    start_ms: u64,
    end_ms: u64,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CancelTranscribeResponse {
    cancelled: bool,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClearTempFilesResponse {
    removed: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordingResponse {
    active: bool,
    path: Option<String>,
    duration_ms: Option<u64>,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordingDeviceResponse {
    id: String,
    label: String,
    status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordingLevelEvent {
    peak: f32,
    rms: f32,
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
    chunk_index: Option<usize>,
    chunk_total: Option<usize>,
    chunk_start_ms: Option<u64>,
    chunk_end_ms: Option<u64>,
}

#[tauri::command]
fn export_sample(request: ExportSampleRequest) -> Result<CommandResponse, String> {
    let format = parse_format(&request.format)?;
    let sample = sample_transcript();
    let output = export_transcript(&sample, format).map_err(|error| error.to_string())?;
    write_optional_output(
        output,
        request.output_path,
        Some(transcript_response(&sample)),
    )
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

#[tauri::command]
fn cancel_transcribe(app: AppHandle) -> Result<CancelTranscribeResponse, String> {
    let state = app.state::<TranscriptionControl>();
    let current_token = state
        .current_token
        .lock()
        .map_err(|_| "failed to lock transcription state".to_string())?;

    if let Some(token) = current_token.as_ref() {
        token.cancel();
        emit_transcribe_progress(&app, "cancelling", "Cancelling transcription", None);
        return Ok(CancelTranscribeResponse {
            cancelled: true,
            message: "Cancellation requested".to_string(),
        });
    }

    Ok(CancelTranscribeResponse {
        cancelled: false,
        message: "No active transcription".to_string(),
    })
}

#[tauri::command]
fn clear_temp_files(app: AppHandle) -> Result<ClearTempFilesResponse, String> {
    let state = app.state::<TranscriptionControl>();
    let current_token = state
        .current_token
        .lock()
        .map_err(|_| "failed to lock transcription state".to_string())?;
    if current_token.is_some() {
        return Err("Cannot clear temp files while transcription is running".to_string());
    }
    drop(current_token);

    Ok(ClearTempFilesResponse {
        removed: cleanup_temp_dirs(None),
    })
}

#[tauri::command]
fn list_library_entries(app: AppHandle) -> Result<Vec<LibraryEntry>, String> {
    read_library_entries(&app)
}

#[tauri::command]
fn save_library_entry(
    app: AppHandle,
    request: SaveLibraryEntryRequest,
) -> Result<Vec<LibraryEntry>, String> {
    let mut entries = read_library_entries(&app)?;
    entries.retain(|entry| entry.id != request.entry.id);
    entries.insert(0, request.entry);
    write_library_entries(&app, &entries)?;
    Ok(entries)
}

#[tauri::command]
fn delete_library_entry(
    app: AppHandle,
    request: LibraryEntryActionRequest,
) -> Result<Vec<LibraryEntry>, String> {
    let mut entries = read_library_entries(&app)?;
    entries.retain(|entry| entry.id != request.id);
    write_library_entries(&app, &entries)?;
    Ok(entries)
}

#[tauri::command]
fn open_library_output(app: AppHandle, request: LibraryEntryActionRequest) -> Result<(), String> {
    let entry = find_library_entry(&app, &request.id)?;
    open_path(&entry.output_path, false)
}

#[tauri::command]
fn reveal_library_output(app: AppHandle, request: LibraryEntryActionRequest) -> Result<(), String> {
    let entry = find_library_entry(&app, &request.id)?;
    open_path(&entry.output_path, true)
}

#[tauri::command]
fn list_recording_devices() -> Result<Vec<RecordingDeviceResponse>, String> {
    let host = cpal::default_host();
    let mut devices = vec![RecordingDeviceResponse {
        id: "system-default".to_string(),
        label: "System Default Microphone".to_string(),
        status: "available".to_string(),
    }];

    let input_devices = host
        .input_devices()
        .map_err(|error| format!("failed to list microphone devices: {error}"))?;
    for (index, device) in input_devices.enumerate() {
        let label = device
            .name()
            .unwrap_or_else(|_| format!("Microphone {}", index + 1));
        devices.push(RecordingDeviceResponse {
            id: format!("device:{index}:{label}"),
            label,
            status: "available".to_string(),
        });
    }

    Ok(devices)
}

#[tauri::command]
fn start_recording(
    app: AppHandle,
    request: StartRecordingRequest,
) -> Result<RecordingResponse, String> {
    let state = app.state::<RecordingControl>();
    let mut active = state
        .active
        .lock()
        .map_err(|_| "failed to lock recording state".to_string())?;

    if let Some(recording) = active.as_ref() {
        return Ok(RecordingResponse {
            active: true,
            path: Some(recording.output_path.to_string_lossy().to_string()),
            duration_ms: Some(
                recording
                    .started_at
                    .elapsed()
                    .as_millis()
                    .try_into()
                    .unwrap_or(u64::MAX),
            ),
            message: "Recording is already running".to_string(),
        });
    }

    let output_path = next_recording_path(&app)?;
    let recording = spawn_recording_thread(&app, &output_path, request.device_id.as_deref())?;
    let response_path = recording.output_path.to_string_lossy().to_string();
    *active = Some(recording);

    Ok(RecordingResponse {
        active: true,
        path: Some(response_path),
        duration_ms: Some(0),
        message: "Recording started".to_string(),
    })
}

#[tauri::command]
fn delete_recording(request: DeleteRecordingRequest) -> Result<(), String> {
    let path = PathBuf::from(request.path.trim());
    if !path_exists(path.to_string_lossy().as_ref()) {
        return Ok(());
    }
    if !is_recording_file_path(&path) {
        return Err("Refusing to delete a file outside Otobun recordings".to_string());
    }
    fs::remove_file(&path)
        .map_err(|error| format!("failed to delete recording {}: {error}", path.display()))
}

#[tauri::command]
fn stop_recording(app: AppHandle) -> Result<RecordingResponse, String> {
    let state = app.state::<RecordingControl>();
    let mut active = state
        .active
        .lock()
        .map_err(|_| "failed to lock recording state".to_string())?;

    let Some(recording) = active.take() else {
        return Ok(RecordingResponse {
            active: false,
            path: None,
            duration_ms: None,
            message: "No active recording".to_string(),
        });
    };

    let _ = recording.stop_tx.send(());
    let duration_ms = recording
        .started_at
        .elapsed()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX);
    let path = recording.output_path.to_string_lossy().to_string();
    if let Some(join_handle) = recording.join_handle {
        join_handle
            .join()
            .map_err(|_| "recording thread panicked".to_string())??;
    }
    let level_adjustment = normalize_recording_file(&recording.output_path)?;
    let message = if level_adjustment.gain > 1.05 {
        format!(
            "Recording saved · level boosted {:.1}x",
            level_adjustment.gain
        )
    } else {
        "Recording saved".to_string()
    };

    Ok(RecordingResponse {
        active: false,
        path: Some(path),
        duration_ms: Some(duration_ms),
        message,
    })
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
    let cancellation_token = CancellationToken::new();
    options.cancellation_token = cancellation_token.clone();

    begin_transcription(&app, cancellation_token)?;
    let response = run_transcription_job(&app, request.output_path, format, &options);
    end_transcription(&app);
    response
}

fn run_transcription_job(
    app: &AppHandle,
    output_path: Option<String>,
    format: ExportFormat,
    options: &TranscribeOptions,
) -> Result<CommandResponse, String> {
    let started_at = Instant::now();
    emit_transcribe_progress(&app, "queued", "Starting transcription", Some(1.0));
    let transcript = transcribe_file_with_progress(&options, |progress| {
        emit_core_transcribe_progress(&app, progress);
    })
    .map_err(|error| error.to_string())?;
    emit_transcribe_progress(&app, "exporting", "Writing transcript output", Some(98.0));
    let output = export_transcript(&transcript, format).map_err(|error| error.to_string())?;
    let mut response =
        write_optional_output(output, output_path, Some(transcript_response(&transcript)))?;
    response.elapsed_ms = Some(
        started_at
            .elapsed()
            .as_millis()
            .try_into()
            .unwrap_or(u64::MAX),
    );
    emit_transcribe_progress(&app, "done", "Transcript ready", Some(100.0));
    Ok(response)
}

fn begin_transcription(app: &AppHandle, token: CancellationToken) -> Result<(), String> {
    let state = app.state::<TranscriptionControl>();
    let mut current_token = state
        .current_token
        .lock()
        .map_err(|_| "failed to lock transcription state".to_string())?;
    if current_token.is_some() {
        return Err("Transcription is already running".to_string());
    }
    *current_token = Some(token);
    Ok(())
}

fn end_transcription(app: &AppHandle) {
    if let Ok(mut current_token) = app.state::<TranscriptionControl>().current_token.lock() {
        *current_token = None;
    }
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
            chunk_index: None,
            chunk_total: None,
            chunk_start_ms: None,
            chunk_end_ms: None,
        },
    );
}

fn emit_core_transcribe_progress(app: &AppHandle, progress: TranscribeProgress) {
    let _ = app.emit(
        "transcribe-progress",
        TranscribeProgressEvent {
            stage: progress.stage.to_string(),
            message: progress.message,
            percent: progress.percent,
            chunk_index: progress.chunk_index,
            chunk_total: progress.chunk_total,
            chunk_start_ms: progress.chunk_start_ms,
            chunk_end_ms: progress.chunk_end_ms,
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

fn library_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("library.json"))
        .map_err(|error| error.to_string())
}

fn read_library_entries(app: &AppHandle) -> Result<Vec<LibraryEntry>, String> {
    let path = library_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let payload = fs::read_to_string(&path).map_err(|error| {
        format!(
            "failed to read transcript library {}: {error}",
            path.display()
        )
    })?;
    if payload.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(&payload).map_err(|error| {
        format!(
            "failed to parse transcript library {}: {error}",
            path.display()
        )
    })
}

fn write_library_entries(app: &AppHandle, entries: &[LibraryEntry]) -> Result<(), String> {
    let path = library_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create transcript library directory {}: {error}",
                parent.display()
            )
        })?;
    }

    let payload = serde_json::to_string_pretty(entries)
        .map_err(|error| format!("failed to serialize transcript library: {error}"))?;
    fs::write(&path, format!("{payload}\n")).map_err(|error| {
        format!(
            "failed to write transcript library {}: {error}",
            path.display()
        )
    })
}

fn find_library_entry(app: &AppHandle, id: &str) -> Result<LibraryEntry, String> {
    read_library_entries(app)?
        .into_iter()
        .find(|entry| entry.id == id)
        .ok_or_else(|| "Library entry not found".to_string())
}

fn open_path(path: &str, reveal: bool) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("Output path is empty".to_string());
    }
    if !Path::new(path).exists() {
        return Err(format!("Output file does not exist: {path}"));
    }

    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        if reveal {
            command.arg("-R");
        }
        command.arg(path);
        command
            .status()
            .map_err(|error| format!("failed to open output path: {error}"))?
            .success()
            .then_some(())
            .ok_or_else(|| "failed to open output path".to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let opener = if reveal {
            Path::new(path).parent()
        } else {
            Some(Path::new(path))
        };
        let Some(opener) = opener else {
            return Err("Output path has no parent directory".to_string());
        };
        Command::new("xdg-open")
            .arg(opener)
            .status()
            .map_err(|error| format!("failed to open output path: {error}"))?
            .success()
            .then_some(())
            .ok_or_else(|| "failed to open output path".to_string())
    }
}

fn recordings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .download_dir()
        .map(|dir| dir.join("Otobun").join("Recordings"))
        .map_err(|error| error.to_string())
}

fn next_recording_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = recordings_dir(app)?;
    fs::create_dir_all(&dir).map_err(|error| {
        format!(
            "failed to create recordings directory {}: {error}",
            dir.display()
        )
    })?;
    let millis = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    Ok(dir.join(format!("otobun-recording-{millis}.wav")))
}

fn is_recording_file_path(path: &Path) -> bool {
    let has_recordings_parent = path
        .parent()
        .and_then(|parent| parent.file_name())
        .and_then(|name| name.to_str())
        .map(|name| name == "Recordings")
        .unwrap_or(false);
    let has_otobun_grandparent = path
        .parent()
        .and_then(|parent| parent.parent())
        .and_then(|parent| parent.file_name())
        .and_then(|name| name.to_str())
        .map(|name| name == "Otobun")
        .unwrap_or(false);
    let has_recording_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with("otobun-recording-") && name.ends_with(".wav"))
        .unwrap_or(false);

    has_recordings_parent && has_otobun_grandparent && has_recording_name
}

fn spawn_recording_thread(
    app: &AppHandle,
    output_path: &Path,
    device_id: Option<&str>,
) -> Result<ActiveRecording, String> {
    let output_path = output_path.to_path_buf();
    let app_handle = app.clone();
    let device_id = device_id.map(str::to_string);
    let (ready_tx, ready_rx) = mpsc::channel();
    let (stop_tx, stop_rx) = mpsc::channel();
    let thread_output_path = output_path.clone();
    let ready_tx_for_error = ready_tx.clone();
    let join_handle = thread::spawn(move || {
        let result = record_to_wav(app_handle, thread_output_path, device_id, stop_rx, ready_tx);
        if let Err(error) = &result {
            let _ = ready_tx_for_error.send(Err(error.clone()));
        }
        result
    });

    let ready_result = match ready_rx.recv_timeout(Duration::from_secs(8)) {
        Ok(result) => result,
        Err(mpsc::RecvTimeoutError::Timeout) => {
            Err("microphone did not become ready in time".to_string())
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            Err("microphone setup failed before recording started".to_string())
        }
    };

    match ready_result {
        Ok(()) => Ok(ActiveRecording {
            output_path,
            started_at: Instant::now(),
            stop_tx,
            join_handle: Some(join_handle),
        }),
        Err(error) => {
            let _ = join_handle.join();
            Err(error)
        }
    }
}

fn record_to_wav(
    app: AppHandle,
    output_path: PathBuf,
    device_id: Option<String>,
    stop_rx: mpsc::Receiver<()>,
    ready_tx: mpsc::Sender<Result<(), String>>,
) -> Result<(), String> {
    let host = cpal::default_host();
    let device = resolve_input_device(&host, device_id.as_deref())?;
    let supported_config = device
        .default_input_config()
        .map_err(|error| format!("failed to read default microphone config: {error}"))?;
    let sample_format = supported_config.sample_format();
    let config = supported_config.config();
    let spec = WavSpec {
        channels: config.channels,
        sample_rate: config.sample_rate.0,
        bits_per_sample: 16,
        sample_format: WavSampleFormat::Int,
    };
    let writer = WavWriter::create(&output_path, spec).map_err(|error| {
        format!(
            "failed to create recording file {}: {error}",
            output_path.display()
        )
    })?;
    let writer = Arc::new(Mutex::new(Some(writer)));
    let last_level_emit = Arc::new(Mutex::new(Instant::now() - Duration::from_millis(250)));
    let on_error = |error| eprintln!("Otobun recording stream error: {error}");

    let stream = match sample_format {
        SampleFormat::F32 => {
            let writer_for_stream = Arc::clone(&writer);
            let app_for_stream = app.clone();
            let last_emit_for_stream = Arc::clone(&last_level_emit);
            device.build_input_stream(
                &config,
                move |data: &[f32], _| {
                    write_f32_samples(&writer_for_stream, data);
                    emit_recording_level(&app_for_stream, &last_emit_for_stream, recording_level_from_f32(data));
                },
                on_error,
                None,
            )
        }
        SampleFormat::I16 => {
            let writer_for_stream = Arc::clone(&writer);
            let app_for_stream = app.clone();
            let last_emit_for_stream = Arc::clone(&last_level_emit);
            device.build_input_stream(
                &config,
                move |data: &[i16], _| {
                    write_i16_samples(&writer_for_stream, data);
                    emit_recording_level(&app_for_stream, &last_emit_for_stream, recording_level_from_i16(data));
                },
                on_error,
                None,
            )
        }
        SampleFormat::U16 => {
            let writer_for_stream = Arc::clone(&writer);
            let app_for_stream = app.clone();
            let last_emit_for_stream = Arc::clone(&last_level_emit);
            device.build_input_stream(
                &config,
                move |data: &[u16], _| {
                    write_u16_samples(&writer_for_stream, data);
                    emit_recording_level(&app_for_stream, &last_emit_for_stream, recording_level_from_u16(data));
                },
                on_error,
                None,
            )
        }
        other => {
            return Err(format!(
                "unsupported microphone sample format: {other:?}. Try using the system default microphone."
            ));
        }
    }
    .map_err(|error| format!("failed to open microphone input stream: {error}"))?;

    stream.play().map_err(|error| {
        format!(
            "failed to start microphone capture. Check macOS microphone permission for Otobun: {error}"
        )
    })?;
    let _ = ready_tx.send(Ok(()));

    let _ = stop_rx.recv();
    drop(stream);

    let mut writer_guard = writer
        .lock()
        .map_err(|_| "failed to finalize recording".to_string())?;
    let writer = writer_guard
        .take()
        .ok_or_else(|| "recording writer already closed".to_string())?;
    writer
        .finalize()
        .map_err(|error| format!("failed to save recording: {error}"))?;
    Ok(())
}

fn resolve_input_device(
    host: &cpal::Host,
    device_id: Option<&str>,
) -> Result<cpal::Device, String> {
    let use_default = device_id
        .map(|value| value.trim().is_empty() || value == "system-default")
        .unwrap_or(true);
    if use_default {
        return host.default_input_device().ok_or_else(|| {
            "No input microphone found. Check macOS Sound settings or connect an input device."
                .to_string()
        });
    }

    let selected_name = parse_recording_device_name(device_id.unwrap_or_default())?;
    let devices = host
        .input_devices()
        .map_err(|error| format!("failed to list microphone devices: {error}"))?;
    for device in devices {
        let name = device.name().unwrap_or_default();
        if name == selected_name {
            return Ok(device);
        }
    }

    Err(format!(
        "Selected microphone is unavailable: {selected_name}. Try System Default Microphone."
    ))
}

fn parse_recording_device_name(device_id: &str) -> Result<&str, String> {
    device_id
        .splitn(3, ':')
        .nth(2)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "invalid microphone device id".to_string())
}

fn emit_recording_level(
    app: &AppHandle,
    last_emit: &Arc<Mutex<Instant>>,
    event: RecordingLevelEvent,
) {
    let Ok(mut last_emit) = last_emit.lock() else {
        return;
    };
    if last_emit.elapsed() < Duration::from_millis(90) {
        return;
    }
    *last_emit = Instant::now();
    let _ = app.emit("recording-level", event);
}

fn recording_level_from_i16(data: &[i16]) -> RecordingLevelEvent {
    if data.is_empty() {
        return RecordingLevelEvent {
            peak: 0.0,
            rms: 0.0,
        };
    }
    let mut peak = 0.0_f32;
    let mut square_sum = 0.0_f64;
    for sample in data {
        let value = f32::from(*sample) / f32::from(i16::MAX);
        peak = peak.max(value.abs());
        square_sum += f64::from(value * value);
    }
    RecordingLevelEvent {
        peak: peak.clamp(0.0, 1.0),
        rms: ((square_sum / data.len() as f64).sqrt() as f32).clamp(0.0, 1.0),
    }
}

fn recording_level_from_u16(data: &[u16]) -> RecordingLevelEvent {
    let samples = data
        .iter()
        .map(|sample| {
            (i32::from(*sample) - 32768).clamp(i32::from(i16::MIN), i32::from(i16::MAX)) as i16
        })
        .collect::<Vec<_>>();
    recording_level_from_i16(&samples)
}

fn recording_level_from_f32(data: &[f32]) -> RecordingLevelEvent {
    if data.is_empty() {
        return RecordingLevelEvent {
            peak: 0.0,
            rms: 0.0,
        };
    }
    let mut peak = 0.0_f32;
    let mut square_sum = 0.0_f64;
    for sample in data {
        let value = sample.clamp(-1.0, 1.0);
        peak = peak.max(value.abs());
        square_sum += f64::from(value * value);
    }
    RecordingLevelEvent {
        peak: peak.clamp(0.0, 1.0),
        rms: ((square_sum / data.len() as f64).sqrt() as f32).clamp(0.0, 1.0),
    }
}

fn with_recording_writer(
    writer: &Arc<Mutex<Option<WavWriter<BufWriter<fs::File>>>>>,
    mut write: impl FnMut(&mut WavWriter<BufWriter<fs::File>>),
) {
    let Ok(mut guard) = writer.lock() else {
        return;
    };
    if let Some(writer) = guard.as_mut() {
        write(writer);
    }
}

fn write_i16_samples(writer: &Arc<Mutex<Option<WavWriter<BufWriter<fs::File>>>>>, data: &[i16]) {
    with_recording_writer(writer, |writer| {
        for sample in data {
            let _ = writer.write_sample(*sample);
        }
    });
}

fn write_u16_samples(writer: &Arc<Mutex<Option<WavWriter<BufWriter<fs::File>>>>>, data: &[u16]) {
    with_recording_writer(writer, |writer| {
        for sample in data {
            let centered = i32::from(*sample) - 32768;
            let _ = writer
                .write_sample(centered.clamp(i32::from(i16::MIN), i32::from(i16::MAX)) as i16);
        }
    });
}

fn write_f32_samples(writer: &Arc<Mutex<Option<WavWriter<BufWriter<fs::File>>>>>, data: &[f32]) {
    with_recording_writer(writer, |writer| {
        for sample in data {
            let normalized = sample.clamp(-1.0, 1.0);
            let _ = writer.write_sample((normalized * f32::from(i16::MAX)).round() as i16);
        }
    });
}

#[derive(Debug, Clone, Copy)]
struct RecordingLevelAdjustment {
    gain: f32,
}

fn normalize_recording_file(path: &Path) -> Result<RecordingLevelAdjustment, String> {
    const TARGET_PEAK_RATIO: f32 = 0.72;
    const MAX_GAIN: f32 = 8.0;

    let mut reader = WavReader::open(path).map_err(|error| {
        format!(
            "failed to inspect recording level {}: {error}",
            path.display()
        )
    })?;
    let spec = reader.spec();
    if spec.sample_format != WavSampleFormat::Int || spec.bits_per_sample != 16 {
        return Ok(RecordingLevelAdjustment { gain: 1.0 });
    }

    let samples = reader
        .samples::<i16>()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("failed to read recording samples: {error}"))?;
    let gain = recording_normalization_gain(&samples, TARGET_PEAK_RATIO, MAX_GAIN);
    if gain <= 1.05 || samples.is_empty() {
        return Ok(RecordingLevelAdjustment { gain });
    }

    let adjusted_samples = samples
        .iter()
        .map(|sample| apply_recording_gain(*sample, gain))
        .collect::<Vec<_>>();
    let mut writer = WavWriter::create(path, spec)
        .map_err(|error| format!("failed to rewrite normalized recording: {error}"))?;
    for sample in adjusted_samples {
        writer
            .write_sample(sample)
            .map_err(|error| format!("failed to write normalized recording sample: {error}"))?;
    }
    writer
        .finalize()
        .map_err(|error| format!("failed to finalize normalized recording: {error}"))?;

    Ok(RecordingLevelAdjustment { gain })
}

fn recording_normalization_gain(samples: &[i16], target_peak_ratio: f32, max_gain: f32) -> f32 {
    let peak = samples
        .iter()
        .map(|sample| i32::from(*sample).abs())
        .max()
        .unwrap_or(0);
    if peak == 0 {
        return 1.0;
    }
    let target_peak = (f32::from(i16::MAX) * target_peak_ratio).max(1.0);
    (target_peak / peak as f32).clamp(1.0, max_gain)
}

fn apply_recording_gain(sample: i16, gain: f32) -> i16 {
    (f32::from(sample) * gain)
        .round()
        .clamp(f32::from(i16::MIN), f32::from(i16::MAX)) as i16
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

fn transcript_response(transcript: &Transcript) -> TranscriptResponse {
    TranscriptResponse {
        title: transcript.title.clone(),
        source: transcript.source.clone(),
        language: transcript.language.clone(),
        speakers: transcript
            .speakers
            .iter()
            .map(|speaker| SpeakerResponse {
                id: speaker.id.clone(),
                label: speaker.label.clone(),
            })
            .collect(),
        segments: transcript
            .segments
            .iter()
            .map(|segment| TranscriptSegmentResponse {
                range: TimeRangeResponse {
                    start_ms: segment.range.start_ms,
                    end_ms: segment.range.end_ms,
                },
                speaker_id: segment.speaker_id.clone(),
                text: segment.text.clone(),
            })
            .collect(),
    }
}

fn write_optional_output(
    output: String,
    output_path: Option<String>,
    transcript: Option<TranscriptResponse>,
) -> Result<CommandResponse, String> {
    let Some(path) = output_path.filter(|value| !value.trim().is_empty()) else {
        return Ok(CommandResponse {
            output,
            wrote_to: None,
            elapsed_ms: None,
            transcript,
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
        elapsed_ms: None,
        transcript,
    })
}

fn cleanup_stale_temp_dirs() {
    const STALE_AFTER: Duration = Duration::from_secs(24 * 60 * 60);

    let _ = cleanup_temp_dirs(Some(STALE_AFTER));
}

fn cleanup_temp_dirs(min_age: Option<Duration>) -> usize {
    let mut removed = 0;

    let Ok(entries) = fs::read_dir(std::env::temp_dir()) else {
        return removed;
    };
    let now = SystemTime::now();

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !is_transcription_temp_dir_name(name) || !path.is_dir() {
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
        if min_age.map(|minimum| age >= minimum).unwrap_or(true) && fs::remove_dir_all(path).is_ok()
        {
            removed += 1;
        }
    }

    removed
}

fn is_transcription_temp_dir_name(name: &str) -> bool {
    name.strip_prefix("otobun-")
        .and_then(|suffix| suffix.chars().next())
        .map(|first_char| first_char.is_ascii_digit())
        .unwrap_or(false)
}

pub fn run() {
    tauri::Builder::default()
        .manage(TranscriptionControl::default())
        .manage(RecordingControl::default())
        .setup(|_app| {
            cleanup_stale_temp_dirs();
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            export_sample,
            get_media_preview,
            transcribe,
            cancel_transcribe,
            clear_temp_files,
            list_library_entries,
            save_library_entry,
            delete_library_entry,
            open_library_output,
            reveal_library_output,
            list_recording_devices,
            start_recording,
            stop_recording,
            delete_recording,
            get_engine_status,
            list_models,
            download_model,
            uninstall_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running Otobun desktop app");
}

#[cfg(test)]
mod tests {
    use super::{
        apply_recording_gain, is_transcription_temp_dir_name, recording_normalization_gain,
    };

    #[test]
    fn matches_only_core_transcription_temp_dir_names() {
        assert!(is_transcription_temp_dir_name("otobun-123-456"));
        assert!(!is_transcription_temp_dir_name("otobun-desktop"));
        assert!(!is_transcription_temp_dir_name("otobun-cache"));
        assert!(!is_transcription_temp_dir_name("other-123"));
    }

    #[test]
    fn computes_recording_gain_for_quiet_samples() {
        let gain = recording_normalization_gain(&[0, 200, -500], 0.72, 8.0);

        assert_eq!(gain, 8.0);
    }

    #[test]
    fn does_not_reduce_already_loud_recordings() {
        let gain = recording_normalization_gain(&[0, 30_000, -12_000], 0.72, 8.0);

        assert_eq!(gain, 1.0);
    }

    #[test]
    fn applies_recording_gain_with_clipping_protection() {
        assert_eq!(apply_recording_gain(2_000, 2.0), 4_000);
        assert_eq!(apply_recording_gain(20_000, 4.0), i16::MAX);
        assert_eq!(apply_recording_gain(-20_000, 4.0), i16::MIN);
    }
}
