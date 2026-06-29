export type ExportFormat = 'md' | 'txt' | 'srt' | 'vtt' | 'json'

export type InputMode = 'file' | 'record'

export type JobState = 'idle' | 'running' | 'done' | 'error'

export type AppSection = 'transcribe' | 'library' | 'models' | 'settings' | 'permissions'

export type OutputLocation = 'downloads' | 'source-folder' | 'custom'

export type TranscribeMode = 'single' | 'smart'

export interface ICommandResponse {
  output: string
  wroteTo?: string | null
  elapsedMs?: number | null
}

export interface IFormatOption {
  value: ExportFormat
  label: string
  help: string
  extension: string
}

export interface IModelCatalogItem {
  id: string
  name: string
  fileName: string
  multilingual: boolean
  sizeMb: number
  speed: string
  quality: string
  description: string
  recommended?: boolean
}

export interface IRecordingDeviceOption {
  id: string
  label: string
  status: 'available' | 'needs-permission' | 'unavailable'
}

export interface IOutputLocationOption {
  id: OutputLocation
  label: string
  description: string
}

export interface IModelFileResponse {
  id: string
  fileName: string
  path: string
  sizeBytes: number
}

export interface IModelDownloadProgress {
  modelId: string
  downloadedBytes: number
  totalBytes?: number | null
  percent?: number | null
  state: string
}

export interface IEngineStatus {
  available: boolean
  binaryPath?: string | null
  version?: string | null
  message: string
}

export interface ITranscribeProgress {
  stage: string
  message: string
  percent?: number | null
  chunkIndex?: number | null
  chunkTotal?: number | null
  chunkStartMs?: number | null
  chunkEndMs?: number | null
}

export interface ITranscribeProgressContext {
  fileName: string
  modelName: string
  modeLabel: string
  languageLabel: string
  formatLabel: string
  outputLabel: string
}

export interface ITranscribeResultMeta {
  elapsedMs?: number | null
  wroteTo?: string | null
}

export interface IMediaPreview {
  durationMs: number
  peaks: number[]
}
