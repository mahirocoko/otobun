use std::fmt;
use std::str::FromStr;

use thiserror::Error;

use crate::Transcript;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Json,
    Markdown,
    Srt,
    Text,
    Vtt,
}

impl fmt::Display for ExportFormat {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Json => "json",
            Self::Markdown => "md",
            Self::Srt => "srt",
            Self::Text => "txt",
            Self::Vtt => "vtt",
        })
    }
}

impl FromStr for ExportFormat {
    type Err = ExportError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "json" => Ok(Self::Json),
            "markdown" | "md" => Ok(Self::Markdown),
            "srt" => Ok(Self::Srt),
            "text" | "txt" => Ok(Self::Text),
            "vtt" => Ok(Self::Vtt),
            other => Err(ExportError::UnsupportedFormat(other.to_string())),
        }
    }
}

#[derive(Debug, Error)]
pub enum ExportError {
    #[error("unsupported export format: {0}")]
    UnsupportedFormat(String),
    #[error("failed to serialize transcript: {0}")]
    Serialize(#[from] serde_json::Error),
}

pub fn export_transcript(
    transcript: &Transcript,
    format: ExportFormat,
) -> Result<String, ExportError> {
    match format {
        ExportFormat::Json => Ok(serde_json::to_string_pretty(transcript)?),
        ExportFormat::Markdown => Ok(export_markdown(transcript)),
        ExportFormat::Srt => Ok(export_srt(transcript)),
        ExportFormat::Text => Ok(transcript.plain_text()),
        ExportFormat::Vtt => Ok(export_vtt(transcript)),
    }
}

fn export_markdown(transcript: &Transcript) -> String {
    let mut output = format!("# {}\n\n", transcript.title);
    if let Some(source) = &transcript.source {
        output.push_str(&format!("_Source: {}_\n\n", source));
    }
    for segment in &transcript.segments {
        let speaker = segment
            .speaker_id
            .as_deref()
            .and_then(|id| transcript.speakers.iter().find(|speaker| speaker.id == id))
            .map(|speaker| speaker.label.as_str())
            .unwrap_or("Speaker");
        output.push_str(&format!(
            "**{}** `{}`  \n{}\n\n",
            speaker,
            format_timestamp_compact(segment.range.start_ms),
            segment.text.trim()
        ));
    }
    output.trim_end().to_string() + "\n"
}

fn export_srt(transcript: &Transcript) -> String {
    transcript
        .segments
        .iter()
        .enumerate()
        .map(|(index, segment)| {
            format!(
                "{}\n{} --> {}\n{}\n",
                index + 1,
                format_srt_timestamp(segment.range.start_ms),
                format_srt_timestamp(segment.range.end_ms),
                segment.text.trim()
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn export_vtt(transcript: &Transcript) -> String {
    let cues = transcript
        .segments
        .iter()
        .map(|segment| {
            format!(
                "{} --> {}\n{}\n",
                format_vtt_timestamp(segment.range.start_ms),
                format_vtt_timestamp(segment.range.end_ms),
                segment.text.trim()
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!("WEBVTT\n\n{}", cues)
}

fn format_timestamp_compact(ms: u64) -> String {
    let total_seconds = ms / 1_000;
    let minutes = total_seconds / 60;
    let seconds = total_seconds % 60;
    format!("{:02}:{:02}", minutes, seconds)
}

fn format_srt_timestamp(ms: u64) -> String {
    format_timestamp(ms, ',')
}

fn format_vtt_timestamp(ms: u64) -> String {
    format_timestamp(ms, '.')
}

fn format_timestamp(ms: u64, separator: char) -> String {
    let hours = ms / 3_600_000;
    let minutes = (ms % 3_600_000) / 60_000;
    let seconds = (ms % 60_000) / 1_000;
    let millis = ms % 1_000;
    format!(
        "{:02}:{:02}:{:02}{}{:03}",
        hours, minutes, seconds, separator, millis
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sample_transcript;

    #[test]
    fn exports_plain_text() {
        let output = export_transcript(&sample_transcript(), ExportFormat::Text).unwrap();
        assert_eq!(
            output,
            "สวัสดี นี่คือ Otobun\nA local-first transcript workspace."
        );
    }

    #[test]
    fn exports_markdown_with_timestamp_and_speaker() {
        let output = export_transcript(&sample_transcript(), ExportFormat::Markdown).unwrap();
        assert!(output.contains("# Otobun sample"));
        assert!(output.contains("**Speaker 1** `00:00`"));
        assert!(output.contains("สวัสดี นี่คือ Otobun"));
    }

    #[test]
    fn exports_srt_timestamps() {
        let output = export_transcript(&sample_transcript(), ExportFormat::Srt).unwrap();
        assert!(output.contains("1\n00:00:00,000 --> 00:00:02,400"));
        assert!(output.contains("2\n00:00:02,500 --> 00:00:05,200"));
    }

    #[test]
    fn exports_vtt_header_and_timestamps() {
        let output = export_transcript(&sample_transcript(), ExportFormat::Vtt).unwrap();
        assert!(output.starts_with("WEBVTT\n\n"));
        assert!(output.contains("00:00:00.000 --> 00:00:02.400"));
    }

    #[test]
    fn parses_format_aliases() {
        assert_eq!(
            "md".parse::<ExportFormat>().unwrap(),
            ExportFormat::Markdown
        );
        assert_eq!("text".parse::<ExportFormat>().unwrap(), ExportFormat::Text);
        assert!("docx".parse::<ExportFormat>().is_err());
    }
}
