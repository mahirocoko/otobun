use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use thiserror::Error;

use crate::{Speaker, TimeRange, Transcript, TranscriptSegment};

#[derive(Debug, Clone)]
pub struct TranscribeOptions {
    pub input: PathBuf,
    pub model: PathBuf,
    pub title: Option<String>,
    pub language: Option<String>,
    pub ffmpeg_bin: PathBuf,
    pub whisper_bin: PathBuf,
    pub keep_temp: bool,
}

impl TranscribeOptions {
    pub fn new(input: impl Into<PathBuf>, model: impl Into<PathBuf>) -> Self {
        Self {
            input: input.into(),
            model: model.into(),
            title: None,
            language: None,
            ffmpeg_bin: PathBuf::from("ffmpeg"),
            whisper_bin: PathBuf::from("whisper-cli"),
            keep_temp: false,
        }
    }
}

#[derive(Debug, Error)]
pub enum TranscribeError {
    #[error("input file does not exist: {0}")]
    MissingInput(PathBuf),
    #[error("model file does not exist: {0}")]
    MissingModel(PathBuf),
    #[error("failed to prepare temp directory: {0}")]
    TempDir(std::io::Error),
    #[error("failed to run ffmpeg: {0}")]
    FfmpegIo(std::io::Error),
    #[error("ffmpeg failed with status {status}: {stderr}")]
    FfmpegFailed { status: String, stderr: String },
    #[error("failed to run whisper: {0}")]
    WhisperIo(std::io::Error),
    #[error("whisper failed with status {status}: {stderr}")]
    WhisperFailed { status: String, stderr: String },
    #[error("whisper did not create JSON output: {0}")]
    MissingWhisperOutput(PathBuf),
    #[error("failed to read whisper JSON output: {0}")]
    ReadWhisperOutput(std::io::Error),
    #[error("failed to parse whisper JSON output: {0}")]
    ParseWhisperOutput(serde_json::Error),
    #[error("unsupported whisper JSON shape")]
    UnsupportedWhisperJson,
}

pub fn transcribe_file(options: &TranscribeOptions) -> Result<Transcript, TranscribeError> {
    if !options.input.exists() {
        return Err(TranscribeError::MissingInput(options.input.clone()));
    }
    if !options.model.exists() {
        return Err(TranscribeError::MissingModel(options.model.clone()));
    }

    let temp_dir = create_temp_dir()?;
    let normalized_wav = temp_dir.join("input.wav");
    let whisper_output_base = temp_dir.join("transcript");
    let whisper_output_json = temp_dir.join("transcript.json");

    let result = normalize_audio(options, &normalized_wav)
        .and_then(|_| run_whisper(options, &normalized_wav, &whisper_output_base))
        .and_then(|_| parse_whisper_output_file(options, &whisper_output_json));

    if !options.keep_temp {
        let _ = fs::remove_dir_all(&temp_dir);
    }

    result
}

fn create_temp_dir() -> Result<PathBuf, TranscribeError> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let dir = std::env::temp_dir().join(format!("otobun-{}-{millis}", std::process::id()));
    fs::create_dir_all(&dir).map_err(TranscribeError::TempDir)?;
    Ok(dir)
}

fn normalize_audio(options: &TranscribeOptions, output_wav: &Path) -> Result<(), TranscribeError> {
    let output = Command::new(&options.ffmpeg_bin)
        .arg("-y")
        .arg("-i")
        .arg(&options.input)
        .arg("-ar")
        .arg("16000")
        .arg("-ac")
        .arg("1")
        .arg("-c:a")
        .arg("pcm_s16le")
        .arg(output_wav)
        .output()
        .map_err(TranscribeError::FfmpegIo)?;

    if !output.status.success() {
        return Err(TranscribeError::FfmpegFailed {
            status: output.status.to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        });
    }

    Ok(())
}

fn run_whisper(
    options: &TranscribeOptions,
    input_wav: &Path,
    output_base: &Path,
) -> Result<(), TranscribeError> {
    let mut command = Command::new(&options.whisper_bin);
    command
        .arg("-m")
        .arg(&options.model)
        .arg("-f")
        .arg(input_wav)
        .arg("-oj")
        .arg("-of")
        .arg(output_base);

    if let Some(language) = &options.language {
        command.arg("-l").arg(language);
    }

    let output = command.output().map_err(TranscribeError::WhisperIo)?;

    if !output.status.success() {
        return Err(TranscribeError::WhisperFailed {
            status: output.status.to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
        });
    }

    Ok(())
}

fn parse_whisper_output_file(
    options: &TranscribeOptions,
    output_json: &Path,
) -> Result<Transcript, TranscribeError> {
    if !output_json.exists() {
        return Err(TranscribeError::MissingWhisperOutput(
            output_json.to_path_buf(),
        ));
    }
    let raw = fs::read_to_string(output_json).map_err(TranscribeError::ReadWhisperOutput)?;
    parse_whisper_json(&raw, options)
}

pub fn parse_whisper_json(
    raw: &str,
    options: &TranscribeOptions,
) -> Result<Transcript, TranscribeError> {
    let document: WhisperDocument =
        serde_json::from_str(raw).map_err(TranscribeError::ParseWhisperOutput)?;
    let segments = document.into_segments()?;
    let title = options.title.clone().unwrap_or_else(|| {
        options
            .input
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("Untitled transcript")
            .to_string()
    });

    Ok(Transcript {
        title,
        source: Some(options.input.to_string_lossy().to_string()),
        language: options.language.clone(),
        speakers: vec![Speaker {
            id: "speaker-1".to_string(),
            label: "Speaker 1".to_string(),
        }],
        segments,
    })
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum WhisperDocument {
    WhisperCpp {
        transcription: Vec<WhisperCppSegment>,
    },
    Segments {
        segments: Vec<WhisperSegment>,
    },
    Array(Vec<WhisperSegment>),
}

impl WhisperDocument {
    fn into_segments(self) -> Result<Vec<TranscriptSegment>, TranscribeError> {
        match self {
            Self::WhisperCpp { transcription } => Ok(transcription
                .into_iter()
                .map(|segment| TranscriptSegment {
                    range: TimeRange::new(segment.offsets.from, segment.offsets.to),
                    speaker_id: Some("speaker-1".to_string()),
                    text: segment.text.trim().to_string(),
                })
                .collect()),
            Self::Segments { segments } | Self::Array(segments) => segments
                .into_iter()
                .map(WhisperSegment::try_into_transcript_segment)
                .collect(),
        }
    }
}

#[derive(Debug, Deserialize)]
struct WhisperCppSegment {
    offsets: WhisperOffsets,
    text: String,
}

#[derive(Debug, Deserialize)]
struct WhisperOffsets {
    from: u64,
    to: u64,
}

#[derive(Debug, Deserialize)]
struct WhisperSegment {
    start: Option<f64>,
    end: Option<f64>,
    start_ms: Option<u64>,
    end_ms: Option<u64>,
    text: String,
}

impl WhisperSegment {
    fn try_into_transcript_segment(self) -> Result<TranscriptSegment, TranscribeError> {
        let Some(start_ms) = self.start_ms.or_else(|| self.start.map(seconds_to_ms)) else {
            return Err(TranscribeError::UnsupportedWhisperJson);
        };
        let Some(end_ms) = self.end_ms.or_else(|| self.end.map(seconds_to_ms)) else {
            return Err(TranscribeError::UnsupportedWhisperJson);
        };

        Ok(TranscriptSegment {
            range: TimeRange::new(start_ms, end_ms),
            speaker_id: Some("speaker-1".to_string()),
            text: self.text.trim().to_string(),
        })
    }
}

fn seconds_to_ms(seconds: f64) -> u64 {
    (seconds * 1_000.0).round().max(0.0) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> TranscribeOptions {
        let mut options = TranscribeOptions::new("meeting.mp4", "model.bin");
        options.title = Some("Demo meeting".to_string());
        options.language = Some("th".to_string());
        options
    }

    #[test]
    fn parses_whisper_cpp_json() {
        let raw = r#"
        {
          "transcription": [
            {"offsets": {"from": 0, "to": 1250}, "text": " สวัสดี "},
            {"offsets": {"from": 1300, "to": 2400}, "text": "Otobun"}
          ]
        }
        "#;

        let transcript = parse_whisper_json(raw, &options()).unwrap();
        assert_eq!(transcript.title, "Demo meeting");
        assert_eq!(transcript.language.as_deref(), Some("th"));
        assert_eq!(transcript.segments.len(), 2);
        assert_eq!(transcript.segments[0].range.end_ms, 1250);
        assert_eq!(transcript.segments[0].text, "สวัสดี");
    }

    #[test]
    fn parses_segment_seconds_json() {
        let raw = r#"
        {
          "segments": [
            {"start": 1.25, "end": 2.5, "text": "Hello"}
          ]
        }
        "#;

        let transcript = parse_whisper_json(raw, &options()).unwrap();
        assert_eq!(transcript.segments[0].range.start_ms, 1250);
        assert_eq!(transcript.segments[0].range.end_ms, 2500);
    }

    #[test]
    fn parses_segment_milliseconds_json() {
        let raw = r#"[{"start_ms": 500, "end_ms": 1500, "text": "Hi"}]"#;

        let transcript = parse_whisper_json(raw, &options()).unwrap();
        assert_eq!(transcript.segments[0].range.start_ms, 500);
        assert_eq!(transcript.segments[0].range.end_ms, 1500);
    }
}
