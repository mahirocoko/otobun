import type { IFormatOption, IModelCatalogItem, IOutputLocationOption, IRecordingDeviceOption } from '../types'

export const FORMAT_OPTIONS: IFormatOption[] = [
  { value: 'md', label: 'Notes', help: 'Clean Markdown transcript', extension: 'md' },
  { value: 'txt', label: 'Text', help: 'Plain text only', extension: 'txt' },
  { value: 'srt', label: 'SRT', help: 'Subtitle file', extension: 'srt' },
  { value: 'vtt', label: 'VTT', help: 'Web captions', extension: 'vtt' },
  { value: 'json', label: 'JSON', help: 'Structured segments', extension: 'json' },
]

export const MEDIA_EXTENSIONS = ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'mp4', 'mov', 'mkv', 'webm']
export const MODEL_EXTENSIONS = ['bin', 'gguf']

export const MODEL_CATALOG: IModelCatalogItem[] = [
  {
    id: 'tiny',
    name: 'Whisper Tiny',
    fileName: 'ggml-tiny.bin',
    multilingual: true,
    sizeMb: 75,
    speed: 'Fastest',
    quality: 'Basic',
    description: 'Quick drafts and short notes on slower machines.',
  },
  {
    id: 'base',
    name: 'Whisper Base',
    fileName: 'ggml-base.bin',
    multilingual: true,
    sizeMb: 142,
    speed: 'Fast',
    quality: 'Good',
    description: 'Balanced default for everyday transcripts.',
    recommended: true,
  },
  {
    id: 'small',
    name: 'Whisper Small',
    fileName: 'ggml-small.bin',
    multilingual: true,
    sizeMb: 466,
    speed: 'Balanced',
    quality: 'Better',
    description: 'Better accuracy for meetings and mixed-language audio.',
  },
  {
    id: 'medium',
    name: 'Whisper Medium',
    fileName: 'ggml-medium.bin',
    multilingual: true,
    sizeMb: 1530,
    speed: 'Slower',
    quality: 'Strong',
    description: 'Stronger recognition for longer or noisier recordings.',
  },
  {
    id: 'large-v3-turbo',
    name: 'Whisper Large v3 Turbo',
    fileName: 'ggml-large-v3-turbo.bin',
    multilingual: true,
    sizeMb: 1620,
    speed: 'Balanced',
    quality: 'Strong',
    description: 'High-quality multilingual option with practical runtime.',
  },
  {
    id: 'large-v3-turbo-q5-0',
    name: 'Whisper Large v3 Turbo Q5',
    fileName: 'ggml-large-v3-turbo-q5_0.bin',
    multilingual: true,
    sizeMb: 1080,
    speed: 'Balanced',
    quality: 'Strong',
    description: 'Quantized turbo model for lower storage use.',
  },
  {
    id: 'large-v3',
    name: 'Whisper Large v3',
    fileName: 'ggml-large-v3.bin',
    multilingual: true,
    sizeMb: 3100,
    speed: 'Slow',
    quality: 'Best',
    description: 'Highest quality option for important recordings.',
  },
  {
    id: 'large-v3-q5-0',
    name: 'Whisper Large v3 Q5',
    fileName: 'ggml-large-v3-q5_0.bin',
    multilingual: true,
    sizeMb: 1810,
    speed: 'Slow',
    quality: 'Best',
    description: 'Quantized large model with reduced storage footprint.',
  },
  {
    id: 'tiny-en',
    name: 'Whisper Tiny English',
    fileName: 'ggml-tiny.en.bin',
    multilingual: false,
    sizeMb: 75,
    speed: 'Fastest',
    quality: 'English',
    description: 'Fast English-only drafts.',
  },
  {
    id: 'base-en',
    name: 'Whisper Base English',
    fileName: 'ggml-base.en.bin',
    multilingual: false,
    sizeMb: 142,
    speed: 'Fast',
    quality: 'English',
    description: 'Everyday English-only transcripts.',
  },
  {
    id: 'small-en',
    name: 'Whisper Small English',
    fileName: 'ggml-small.en.bin',
    multilingual: false,
    sizeMb: 466,
    speed: 'Balanced',
    quality: 'English',
    description: 'Better English-only accuracy.',
  },
]

export const RECORDING_DEVICE_OPTIONS: IRecordingDeviceOption[] = [
  { id: 'system-default', label: 'System Default Microphone', status: 'available' },
]

export const OUTPUT_LOCATION_OPTIONS: IOutputLocationOption[] = [
  { id: 'downloads', label: 'Downloads', description: 'Save finished transcript files to Downloads by default.' },
  { id: 'source-folder', label: 'Source Folder', description: 'Save next to the original media file when possible.' },
  { id: 'custom', label: 'Custom Location', description: 'Choose a destination for this transcript.' },
]
