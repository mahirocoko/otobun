use std::process::ExitCode;

use clap::{Parser, Subcommand};
use std::path::PathBuf;

use otobun_core::{
    export_transcript, sample_transcript, transcribe_file, ExportFormat, TranscribeOptions,
};

#[derive(Debug, Parser)]
#[command(name = "otobun", version, about = "Local-first transcript workspace")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Export a built-in sample transcript in the requested format.
    ExportSample {
        /// Output format: txt, md, srt, vtt, json.
        #[arg(short, long, default_value = "md")]
        format: ExportFormat,
    },
    /// Transcribe a local audio/video file through ffmpeg and whisper-cli.
    Transcribe {
        /// Input audio/video file.
        input: PathBuf,
        /// Whisper model path, for example ggml-base.bin.
        #[arg(short, long)]
        model: PathBuf,
        /// Output format: txt, md, srt, vtt, json.
        #[arg(short, long, default_value = "md")]
        format: ExportFormat,
        /// Transcript title. Defaults to the input file stem.
        #[arg(long)]
        title: Option<String>,
        /// Whisper language code, for example th, en, or auto.
        #[arg(short, long)]
        language: Option<String>,
        /// ffmpeg binary path.
        #[arg(long, env = "OTOBUN_FFMPEG_BIN", default_value = "ffmpeg")]
        ffmpeg_bin: PathBuf,
        /// whisper-cli binary path.
        #[arg(long, env = "OTOBUN_WHISPER_BIN", default_value = "whisper-cli")]
        whisper_bin: PathBuf,
        /// Keep temporary normalized audio and whisper output for debugging.
        #[arg(long)]
        keep_temp: bool,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    match run(cli) {
        Ok(output) => {
            print!("{}", output);
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("otobun: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(cli: Cli) -> Result<String, Box<dyn std::error::Error>> {
    match cli.command {
        Commands::ExportSample { format } => Ok(export_transcript(&sample_transcript(), format)?),
        Commands::Transcribe {
            input,
            model,
            format,
            title,
            language,
            ffmpeg_bin,
            whisper_bin,
            keep_temp,
        } => {
            let mut options = TranscribeOptions::new(input, model);
            options.title = title;
            options.language = language;
            options.ffmpeg_bin = ffmpeg_bin;
            options.whisper_bin = whisper_bin;
            options.keep_temp = keep_temp;
            let transcript = transcribe_file(&options)?;
            Ok(export_transcript(&transcript, format)?)
        }
    }
}
