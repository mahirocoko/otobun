use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Speaker {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimeRange {
    pub start_ms: u64,
    pub end_ms: u64,
}

impl TimeRange {
    pub fn new(start_ms: u64, end_ms: u64) -> Self {
        Self { start_ms, end_ms }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub range: TimeRange,
    pub speaker_id: Option<String>,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Transcript {
    pub title: String,
    pub source: Option<String>,
    pub language: Option<String>,
    pub speakers: Vec<Speaker>,
    pub segments: Vec<TranscriptSegment>,
}

impl Transcript {
    pub fn plain_text(&self) -> String {
        self.segments
            .iter()
            .map(|segment| segment.text.trim())
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("\n")
    }
}

pub fn sample_transcript() -> Transcript {
    Transcript {
        title: "Otobun sample".to_string(),
        source: Some("sample://otobun".to_string()),
        language: Some("mixed-th-en".to_string()),
        speakers: vec![Speaker {
            id: "speaker-1".to_string(),
            label: "Speaker 1".to_string(),
        }],
        segments: vec![
            TranscriptSegment {
                range: TimeRange::new(0, 2_400),
                speaker_id: Some("speaker-1".to_string()),
                text: "สวัสดี นี่คือ Otobun".to_string(),
            },
            TranscriptSegment {
                range: TimeRange::new(2_500, 5_200),
                speaker_id: Some("speaker-1".to_string()),
                text: "A local-first transcript workspace.".to_string(),
            },
        ],
    }
}
