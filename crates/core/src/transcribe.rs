use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc,
};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use thiserror::Error;

use crate::{Speaker, TimeRange, Transcript, TranscriptSegment};

#[derive(Debug, Clone, Default)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    pub fn new() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

#[derive(Debug, Clone)]
pub struct TranscribeProgress {
    pub stage: &'static str,
    pub message: String,
    pub percent: Option<f64>,
    pub chunk_index: Option<usize>,
    pub chunk_total: Option<usize>,
    pub chunk_start_ms: Option<u64>,
    pub chunk_end_ms: Option<u64>,
}

impl TranscribeProgress {
    fn new(stage: &'static str, message: impl Into<String>, percent: Option<f64>) -> Self {
        Self {
            stage,
            message: message.into(),
            percent,
            chunk_index: None,
            chunk_total: None,
            chunk_start_ms: None,
            chunk_end_ms: None,
        }
    }

    fn with_chunk(mut self, index: usize, total: usize, chunk: AudioChunk) -> Self {
        self.chunk_index = Some(index);
        self.chunk_total = Some(total);
        self.chunk_start_ms = Some(chunk.start_ms);
        self.chunk_end_ms = Some(chunk.end_ms);
        self
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChunkMode {
    Single,
    Smart,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecodeProfile {
    Fast,
    ThaiDialogue,
}

#[derive(Debug, Clone)]
pub struct TranscribeOptions {
    pub input: PathBuf,
    pub model: PathBuf,
    pub title: Option<String>,
    pub language: Option<String>,
    pub ffmpeg_bin: PathBuf,
    pub whisper_bin: PathBuf,
    pub keep_temp: bool,
    pub chunk_mode: ChunkMode,
    pub decode_profile: DecodeProfile,
    pub cancellation_token: CancellationToken,
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
            chunk_mode: ChunkMode::Single,
            decode_profile: DecodeProfile::Fast,
            cancellation_token: CancellationToken::new(),
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
    #[error("transcription cancelled")]
    Cancelled,
    #[error("failed to inspect normalized audio duration")]
    InspectDuration,
}

pub fn transcribe_file(options: &TranscribeOptions) -> Result<Transcript, TranscribeError> {
    transcribe_file_with_progress(options, |_| {})
}

pub fn transcribe_file_with_progress<F>(
    options: &TranscribeOptions,
    mut on_progress: F,
) -> Result<Transcript, TranscribeError>
where
    F: FnMut(TranscribeProgress),
{
    if !options.input.exists() {
        return Err(TranscribeError::MissingInput(options.input.clone()));
    }
    if !options.model.exists() {
        return Err(TranscribeError::MissingModel(options.model.clone()));
    }

    check_cancelled(options)?;
    on_progress(TranscribeProgress::new(
        "preparing",
        "Preparing workspace",
        Some(2.0),
    ));

    let temp_dir = create_temp_dir()?;
    let normalized_wav = temp_dir.join("input.wav");
    let whisper_output_base = temp_dir.join("transcript");
    let whisper_output_json = temp_dir.join("transcript.json");

    let result = normalize_audio(options, &normalized_wav, &mut on_progress).and_then(|_| {
        match options.chunk_mode {
            ChunkMode::Single => transcribe_single_pass(
                options,
                &normalized_wav,
                &whisper_output_base,
                &whisper_output_json,
                &mut on_progress,
            ),
            ChunkMode::Smart => {
                transcribe_smart_chunks(options, &temp_dir, &normalized_wav, &mut on_progress)
            }
        }
    });

    if !options.keep_temp {
        let _ = fs::remove_dir_all(&temp_dir);
    }

    if result.is_ok() {
        on_progress(TranscribeProgress::new(
            "done",
            "Transcription complete",
            Some(100.0),
        ));
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

fn normalize_audio<F>(
    options: &TranscribeOptions,
    output_wav: &Path,
    on_progress: &mut F,
) -> Result<(), TranscribeError>
where
    F: FnMut(TranscribeProgress),
{
    on_progress(TranscribeProgress::new(
        "normalizing",
        "Normalizing audio with ffmpeg",
        Some(8.0),
    ));

    let mut command = Command::new(&options.ffmpeg_bin);
    command
        .arg("-y")
        .arg("-i")
        .arg(&options.input)
        .arg("-ar")
        .arg("16000")
        .arg("-ac")
        .arg("1")
        .arg("-c:a")
        .arg("pcm_s16le")
        .arg(output_wav);

    let (status, stderr) = run_ffmpeg_command(options, &mut command)?;
    if !status.success() {
        return Err(TranscribeError::FfmpegFailed {
            status: status.to_string(),
            stderr: stderr.trim().to_string(),
        });
    }

    on_progress(TranscribeProgress::new(
        "normalizing",
        "Audio normalized",
        Some(18.0),
    ));
    Ok(())
}

fn run_whisper<F>(
    options: &TranscribeOptions,
    input_wav: &Path,
    output_base: &Path,
    on_progress: &mut F,
    progress_start: f64,
    progress_span: f64,
    progress_message: String,
    chunk_context: Option<(usize, usize, AudioChunk)>,
) -> Result<(), TranscribeError>
where
    F: FnMut(TranscribeProgress),
{
    check_cancelled(options)?;
    let thread_count = std::thread::available_parallelism()
        .map(|count| count.get().saturating_sub(1).clamp(4, 8))
        .unwrap_or(4);

    let initial_progress = TranscribeProgress::new(
        "transcribing",
        format!("{progress_message} with {thread_count} threads"),
        Some(progress_start),
    );
    on_progress(match chunk_context {
        Some((index, total, chunk)) => initial_progress.with_chunk(index, total, chunk),
        None => initial_progress,
    });

    let mut command = Command::new(&options.whisper_bin);
    let (beam_size, best_of, prompt) = match options.decode_profile {
        DecodeProfile::Fast => (1, 1, None),
        DecodeProfile::ThaiDialogue => (5, 5, Some("ภาษาไทย บทสนทนา คำถาม คำตอบ")),
    };

    command
        .arg("-m")
        .arg(&options.model)
        .arg("-f")
        .arg(input_wav)
        .arg("-oj")
        .arg("-of")
        .arg(output_base)
        .arg("-pp")
        .arg("-t")
        .arg(thread_count.to_string())
        .arg("-p")
        .arg("1")
        .arg("-bs")
        .arg(beam_size.to_string())
        .arg("-bo")
        .arg(best_of.to_string());

    if let Some(prompt) = prompt {
        command.arg("--prompt").arg(prompt);
    }

    if let Some(language) = &options.language {
        command.arg("-l").arg(language);
    }

    let mut child = command
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(TranscribeError::WhisperIo)?;

    let (line_tx, line_rx) = mpsc::channel();
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if line_tx.send(line).is_err() {
                    break;
                }
            }
        });
    }

    let mut stderr_output = String::new();
    let status = loop {
        while let Ok(line_result) = line_rx.try_recv() {
            let line = line_result.map_err(TranscribeError::WhisperIo)?;
            if !line.trim().is_empty() {
                stderr_output.push_str(&line);
                stderr_output.push('\n');
            }
            if let Some(percent) = parse_whisper_progress(&line) {
                let progress_update = TranscribeProgress::new(
                    "transcribing",
                    progress_message.clone(),
                    Some(progress_start + (percent * progress_span / 100.0)),
                );
                on_progress(match chunk_context {
                    Some((index, total, chunk)) => progress_update.with_chunk(index, total, chunk),
                    None => progress_update,
                });
            }
        }

        if options.cancellation_token.is_cancelled() {
            let _ = child.kill();
            let _ = child.wait();
            return Err(TranscribeError::Cancelled);
        }

        if let Some(status) = child.try_wait().map_err(TranscribeError::WhisperIo)? {
            break status;
        }

        thread::sleep(Duration::from_millis(80));
    };

    while let Ok(line_result) = line_rx.try_recv() {
        let line = line_result.map_err(TranscribeError::WhisperIo)?;
        if !line.trim().is_empty() {
            stderr_output.push_str(&line);
            stderr_output.push('\n');
        }
    }
    if !status.success() {
        return Err(TranscribeError::WhisperFailed {
            status: status.to_string(),
            stderr: stderr_output.trim().to_string(),
        });
    }

    let finished_progress = TranscribeProgress::new(
        "transcribing",
        "whisper.cpp finished",
        Some(progress_start + progress_span),
    );
    on_progress(match chunk_context {
        Some((index, total, chunk)) => finished_progress.with_chunk(index, total, chunk),
        None => finished_progress,
    });
    Ok(())
}

fn check_cancelled(options: &TranscribeOptions) -> Result<(), TranscribeError> {
    if options.cancellation_token.is_cancelled() {
        Err(TranscribeError::Cancelled)
    } else {
        Ok(())
    }
}

fn run_ffmpeg_command(
    options: &TranscribeOptions,
    command: &mut Command,
) -> Result<(ExitStatus, String), TranscribeError> {
    check_cancelled(options)?;
    let mut child = command
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(TranscribeError::FfmpegIo)?;

    let (stderr_tx, stderr_rx) = mpsc::channel();
    if let Some(mut stderr) = child.stderr.take() {
        thread::spawn(move || {
            let mut output = String::new();
            let _ = stderr.read_to_string(&mut output);
            let _ = stderr_tx.send(output);
        });
    }

    let status = loop {
        if options.cancellation_token.is_cancelled() {
            let _ = child.kill();
            let _ = child.wait();
            return Err(TranscribeError::Cancelled);
        }

        if let Some(status) = child.try_wait().map_err(TranscribeError::FfmpegIo)? {
            break status;
        }

        thread::sleep(Duration::from_millis(80));
    };

    let stderr = stderr_rx
        .recv_timeout(Duration::from_secs(1))
        .unwrap_or_default();
    Ok((status, stderr))
}

fn parse_whisper_progress(line: &str) -> Option<f64> {
    let percent_index = line.find('%')?;
    let before_percent = &line[..percent_index];
    let number = before_percent
        .split(|character: char| !(character.is_ascii_digit() || character == '.'))
        .filter(|part| !part.is_empty())
        .next_back()?;
    number
        .parse::<f64>()
        .ok()
        .map(|value| value.clamp(0.0, 100.0))
}

fn transcribe_single_pass<F>(
    options: &TranscribeOptions,
    normalized_wav: &Path,
    whisper_output_base: &Path,
    whisper_output_json: &Path,
    on_progress: &mut F,
) -> Result<Transcript, TranscribeError>
where
    F: FnMut(TranscribeProgress),
{
    check_cancelled(options)?;
    run_whisper(
        options,
        normalized_wav,
        whisper_output_base,
        on_progress,
        22.0,
        72.0,
        "Running whisper.cpp".to_string(),
        None,
    )?;
    on_progress(TranscribeProgress::new(
        "parsing",
        "Reading transcript output",
        Some(96.0),
    ));
    check_cancelled(options)?;
    parse_whisper_output_file(options, whisper_output_json)
}

#[derive(Debug, Clone, Copy)]
struct AudioChunk {
    start_ms: u64,
    end_ms: u64,
}

impl AudioChunk {
    fn duration_ms(self) -> u64 {
        self.end_ms.saturating_sub(self.start_ms)
    }
}

fn transcribe_smart_chunks<F>(
    options: &TranscribeOptions,
    temp_dir: &Path,
    normalized_wav: &Path,
    on_progress: &mut F,
) -> Result<Transcript, TranscribeError>
where
    F: FnMut(TranscribeProgress),
{
    let duration_ms = wav_duration_ms(normalized_wav)?;

    on_progress(TranscribeProgress::new(
        "chunking",
        "Finding quiet split points",
        Some(20.0),
    ));
    let silence_boundaries = detect_silence_boundaries(options, normalized_wav).unwrap_or_default();
    let chunks = plan_chunks(duration_ms, &silence_boundaries);
    let total_chunks = chunks.len().max(1);
    let mut segments = Vec::new();

    for (index, chunk) in chunks.iter().enumerate() {
        check_cancelled(options)?;
        let chunk_number = index + 1;
        let chunk_path = temp_dir.join(format!("chunk-{chunk_number:04}.wav"));
        let output_base = temp_dir.join(format!("transcript-{chunk_number:04}"));
        let output_json = temp_dir.join(format!("transcript-{chunk_number:04}.json"));
        let base_progress = 22.0 + ((index as f64 / total_chunks as f64) * 72.0);
        let span = 72.0 / total_chunks as f64;

        on_progress(
            TranscribeProgress::new(
                "chunking",
                format!("Preparing chunk {chunk_number}/{total_chunks}"),
                Some(base_progress),
            )
            .with_chunk(chunk_number, total_chunks, *chunk),
        );
        extract_chunk(options, normalized_wav, &chunk_path, *chunk)?;
        run_whisper(
            options,
            &chunk_path,
            &output_base,
            on_progress,
            base_progress,
            span * 0.92,
            format!("Transcribing chunk {chunk_number}/{total_chunks}"),
            Some((chunk_number, total_chunks, *chunk)),
        )?;
        let mut chunk_transcript = parse_whisper_output_file(options, &output_json)?;
        for segment in &mut chunk_transcript.segments {
            segment.range.start_ms += chunk.start_ms;
            segment.range.end_ms += chunk.start_ms;
        }
        segments.extend(chunk_transcript.segments);
    }

    on_progress(TranscribeProgress::new(
        "parsing",
        "Merging transcript chunks",
        Some(96.0),
    ));

    Ok(Transcript {
        title: transcript_title(options),
        source: Some(options.input.to_string_lossy().to_string()),
        language: options.language.clone(),
        speakers: default_speakers(),
        segments,
    })
}

fn wav_duration_ms(path: &Path) -> Result<u64, TranscribeError> {
    let metadata = fs::metadata(path).map_err(|_| TranscribeError::InspectDuration)?;
    let data_bytes = metadata.len().saturating_sub(44);
    let bytes_per_second = 16_000_u64 * 2;
    Ok((data_bytes * 1000) / bytes_per_second)
}

fn detect_silence_boundaries(
    options: &TranscribeOptions,
    input_wav: &Path,
) -> Result<Vec<u64>, TranscribeError> {
    for (noise, duration) in [("-35dB", "0.6"), ("-40dB", "0.35"), ("-30dB", "0.9")] {
        let boundaries = detect_silence_boundaries_with(options, input_wav, noise, duration)?;
        if !boundaries.is_empty() {
            return Ok(boundaries);
        }
    }

    Ok(Vec::new())
}

fn detect_silence_boundaries_with(
    options: &TranscribeOptions,
    input_wav: &Path,
    noise: &str,
    duration: &str,
) -> Result<Vec<u64>, TranscribeError> {
    let filter = format!("silencedetect=noise={noise}:d={duration}");
    let mut command = Command::new(&options.ffmpeg_bin);
    command
        .arg("-i")
        .arg(input_wav)
        .arg("-af")
        .arg(filter)
        .arg("-f")
        .arg("null")
        .arg("-");

    let (_status, stderr) = run_ffmpeg_command(options, &mut command)?;
    let mut starts = Vec::new();
    let mut boundaries = Vec::new();

    for line in stderr.lines() {
        if let Some(value) = parse_silence_value(line, "silence_start:") {
            starts.push(value);
        } else if let Some(end) = parse_silence_value(line, "silence_end:") {
            if let Some(start) = starts.pop() {
                boundaries.push((((start + end) / 2.0) * 1000.0).round() as u64);
            }
        }
    }

    boundaries.sort_unstable();
    boundaries.dedup();
    Ok(boundaries)
}

fn parse_silence_value(line: &str, marker: &str) -> Option<f64> {
    let start = line.find(marker)? + marker.len();
    line[start..]
        .split_whitespace()
        .next()?
        .trim()
        .parse::<f64>()
        .ok()
}

fn plan_chunks(duration_ms: u64, silence_boundaries: &[u64]) -> Vec<AudioChunk> {
    const TARGET_MS: u64 = 3 * 60 * 1000;
    const MIN_MS: u64 = 75 * 1000;
    const MAX_MS: u64 = 4 * 60 * 1000;

    let mut chunks = Vec::new();
    let mut start = 0_u64;

    while duration_ms.saturating_sub(start) > MAX_MS {
        let target = start + TARGET_MS;
        let min_boundary = start + MIN_MS;
        let max_boundary = (start + MAX_MS).min(duration_ms);
        let boundary = silence_boundaries
            .iter()
            .copied()
            .filter(|value| *value >= min_boundary && *value <= max_boundary)
            .min_by_key(|value| value.abs_diff(target))
            .unwrap_or(target.min(duration_ms));

        chunks.push(AudioChunk {
            start_ms: start,
            end_ms: boundary,
        });
        start = boundary;
    }

    if start < duration_ms {
        chunks.push(AudioChunk {
            start_ms: start,
            end_ms: duration_ms,
        });
    }

    if chunks.len() > 1 {
        let last_index = chunks.len() - 1;
        if chunks[last_index].duration_ms() < MIN_MS {
            let last_end = chunks[last_index].end_ms;
            chunks[last_index - 1].end_ms = last_end;
            chunks.pop();
        }
    }

    chunks
}

fn extract_chunk(
    options: &TranscribeOptions,
    input_wav: &Path,
    output_wav: &Path,
    chunk: AudioChunk,
) -> Result<(), TranscribeError> {
    let start_seconds = format_seconds(chunk.start_ms);
    let duration_seconds = format_seconds(chunk.duration_ms());
    let mut command = Command::new(&options.ffmpeg_bin);
    command
        .arg("-y")
        .arg("-ss")
        .arg(start_seconds)
        .arg("-i")
        .arg(input_wav)
        .arg("-t")
        .arg(duration_seconds)
        .arg("-ar")
        .arg("16000")
        .arg("-ac")
        .arg("1")
        .arg("-c:a")
        .arg("pcm_s16le")
        .arg(output_wav);

    let (status, stderr) = run_ffmpeg_command(options, &mut command)?;
    if !status.success() {
        return Err(TranscribeError::FfmpegFailed {
            status: status.to_string(),
            stderr: stderr.trim().to_string(),
        });
    }

    Ok(())
}

fn format_seconds(ms: u64) -> String {
    format!("{:.3}", ms as f64 / 1000.0)
}

fn transcript_title(options: &TranscribeOptions) -> String {
    options.title.clone().unwrap_or_else(|| {
        options
            .input
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("Untitled transcript")
            .to_string()
    })
}

fn default_speakers() -> Vec<Speaker> {
    vec![Speaker {
        id: "speaker-1".to_string(),
        label: "Transcript".to_string(),
    }]
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
    let raw = fs::read(output_json).map_err(TranscribeError::ReadWhisperOutput)?;
    let document = String::from_utf8_lossy(&raw);
    parse_whisper_json(&document, options)
}

pub fn parse_whisper_json(
    raw: &str,
    options: &TranscribeOptions,
) -> Result<Transcript, TranscribeError> {
    let document: WhisperDocument =
        serde_json::from_str(raw).map_err(TranscribeError::ParseWhisperOutput)?;
    let segments = document.into_segments()?;
    Ok(Transcript {
        title: transcript_title(options),
        source: Some(options.input.to_string_lossy().to_string()),
        language: options.language.clone(),
        speakers: default_speakers(),
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

    #[test]
    fn cancels_running_ffmpeg_child_process() {
        let mut options = options();
        options.cancellation_token = CancellationToken::new();
        let cancellation_token = options.cancellation_token.clone();
        let mut command = Command::new("/bin/sh");
        command.arg("-c").arg("sleep 5; echo should-not-finish >&2");

        let started_at = std::time::Instant::now();
        let canceller = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(120));
            cancellation_token.cancel();
        });

        let result = run_ffmpeg_command(&options, &mut command);
        canceller.join().unwrap();

        assert!(matches!(result, Err(TranscribeError::Cancelled)));
        assert!(started_at.elapsed() < Duration::from_secs(2));
    }

    #[test]
    fn cancels_running_whisper_child_process() {
        use std::os::unix::fs::PermissionsExt;

        let script_path = std::env::temp_dir().join(format!(
            "otobun-fake-whisper-{}-{}.sh",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()
        ));
        fs::write(
            &script_path,
            "#!/bin/sh\nwhile true; do echo 'progress 10%' >&2; sleep 1; done\n",
        )
        .unwrap();
        let mut permissions = fs::metadata(&script_path).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&script_path, permissions).unwrap();

        let mut options = options();
        options.whisper_bin = script_path.clone();
        options.cancellation_token = CancellationToken::new();
        let cancellation_token = options.cancellation_token.clone();
        let started_at = std::time::Instant::now();
        let canceller = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(120));
            cancellation_token.cancel();
        });

        let result = run_whisper(
            &options,
            Path::new("input.wav"),
            Path::new("transcript"),
            &mut |_| {},
            0.0,
            100.0,
            "Testing fake whisper".to_string(),
            None,
        );
        canceller.join().unwrap();
        let _ = fs::remove_file(script_path);

        assert!(matches!(result, Err(TranscribeError::Cancelled)));
        assert!(started_at.elapsed() < Duration::from_secs(2));
    }
}
