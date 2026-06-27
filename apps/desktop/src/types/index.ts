export type ExportFormat = 'md' | 'txt' | 'srt' | 'vtt' | 'json'

export type InputMode = 'file' | 'record'

export type JobState = 'idle' | 'running' | 'done' | 'error'

export type AppSection = 'transcribe' | 'library' | 'models' | 'settings' | 'permissions'

export type OutputLocation = 'downloads' | 'source-folder' | 'custom'

export interface ICommandResponse {
  output: string
  wroteTo?: string | null
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
