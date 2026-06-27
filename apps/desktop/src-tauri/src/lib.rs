use std::fs;
use std::path::PathBuf;

use otobun_core::{export_transcript, sample_transcript, transcribe_file, ExportFormat, TranscribeOptions};
use serde::{Deserialize, Serialize};

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
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandResponse {
    output: String,
    wrote_to: Option<String>,
}

#[tauri::command]
fn export_sample(request: ExportSampleRequest) -> Result<CommandResponse, String> {
    let format = parse_format(&request.format)?;
    let output = export_transcript(&sample_transcript(), format).map_err(|error| error.to_string())?;
    write_optional_output(output, request.output_path)
}

#[tauri::command]
fn transcribe(request: TranscribeRequest) -> Result<CommandResponse, String> {
    let format = parse_format(&request.format)?;
    let mut options = TranscribeOptions::new(request.input, request.model);
    options.title = request.title;
    options.language = request.language;
    options.keep_temp = request.keep_temp;

    if let Some(ffmpeg_bin) = request.ffmpeg_bin.filter(|value| !value.trim().is_empty()) {
        options.ffmpeg_bin = PathBuf::from(ffmpeg_bin);
    }
    if let Some(whisper_bin) = request.whisper_bin.filter(|value| !value.trim().is_empty()) {
        options.whisper_bin = PathBuf::from(whisper_bin);
    }

    let transcript = transcribe_file(&options).map_err(|error| error.to_string())?;
    let output = export_transcript(&transcript, format).map_err(|error| error.to_string())?;
    write_optional_output(output, request.output_path)
}

fn parse_format(value: &str) -> Result<ExportFormat, String> {
    value.parse::<ExportFormat>().map_err(|error| error.to_string())
}

fn write_optional_output(output: String, output_path: Option<String>) -> Result<CommandResponse, String> {
    let Some(path) = output_path.filter(|value| !value.trim().is_empty()) else {
        return Ok(CommandResponse { output, wrote_to: None });
    };

    fs::write(&path, &output).map_err(|error| format!("failed to write output file {path}: {error}"))?;
    Ok(CommandResponse {
        output,
        wrote_to: Some(path),
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_sample, transcribe])
        .run(tauri::generate_context!())
        .expect("error while running Otobun desktop app");
}
