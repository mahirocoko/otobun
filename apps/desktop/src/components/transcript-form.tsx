import { MODEL_CATALOG } from '../constants'
import type {
  AppSection,
  DecodeProfile,
  ExportFormat,
  IEngineStatus,
  ILibraryEntry,
  InputMode,
  IRecordingDeviceOption,
  IRecordingLevelEvent,
  JobState,
  OutputLocation,
  TranscribeMode,
} from '../types'
import { getFileName } from './transcript-form/helpers'
import { LibraryPanel } from './transcript-form/library-panel'
import { ModelManagerPanel } from './transcript-form/model-manager-panel'
import { PermissionsPanel } from './transcript-form/permissions-panel'
import { SettingsPanel } from './transcript-form/settings-panel'
import { TranscribeActionFooter } from './transcript-form/transcribe-action-footer'
import { TranscribeModelPanel } from './transcript-form/transcribe-model-panel'
import { TranscribeOptionsPanel } from './transcript-form/transcribe-options-panel'
import { TranscribeOutputPanel } from './transcript-form/transcribe-output-panel'
import { TranscribeSourcePanel } from './transcript-form/transcribe-source-panel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface ITranscriptFormProps {
  activeSection: AppSection
  canTranscribe: boolean
  engineStatus: IEngineStatus | null
  ffmpegBin: string
  format: ExportFormat
  decodeProfile: DecodeProfile
  input: string
  inputMode: InputMode
  keepTemp: boolean
  language: string
  libraryEntries: ILibraryEntry[]
  model: string
  outputLocation: OutputLocation
  outputPath: string
  recordingDeviceId: string
  recordingDeviceOptions: IRecordingDeviceOption[]
  recordingElapsedMs: number
  recordingLevel: IRecordingLevelEvent
  recordingPath: string
  recordingState: 'idle' | 'recording' | 'saving' | 'review'
  status: JobState
  title: string
  transcribeMode: TranscribeMode
  whisperBin: string
  selectedModelId: string
  installedModels: Record<string, string>
  downloadingModels: Record<string, number>
  uninstallingId: string | null
  onChangeSelectedModelId: (value: string) => void
  onDownloadModel: (id: string) => void
  onUninstallModel: (id: string) => void
  onChangeActiveSection: (value: AppSection) => void
  onChangeFfmpegBin: (value: string) => void
  onChangeFormat: (value: ExportFormat) => void
  onChangeDecodeProfile: (value: DecodeProfile) => void
  onChangeInputMode: (value: InputMode) => void
  onChangeOutputLocation: (value: OutputLocation) => void
  onChangeKeepTemp: (value: boolean) => void
  onChangeLanguage: (value: string) => void
  onChangeRecordingDevice: (value: string) => void
  onChangeTitle: (value: string) => void
  onChangeTranscribeMode: (value: TranscribeMode) => void
  onChangeWhisperBin: (value: string) => void
  onChooseInput: () => void
  onChooseModel: () => void
  onChooseOutput: () => void
  onClearTempFiles: () => void
  onExportSample: () => void
  onDeleteLibraryEntry: (id: string) => void
  onOpenLibraryOutput: (id: string) => void
  onRefreshLibrary: () => void
  onRevealLibraryOutput: (id: string) => void
  onTranscribe: () => void
  onDeleteRecording: () => void
  onRecordAgain: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onUseRecording: () => void
  onRemoveInput: () => void
}

const TranscriptForm = ({
  activeSection,
  canTranscribe,
  downloadingModels,
  uninstallingId,
  engineStatus,
  ffmpegBin,
  format,
  decodeProfile,
  input,
  inputMode,
  installedModels,
  keepTemp,
  language,
  libraryEntries,
  model,
  outputLocation,
  outputPath,
  recordingDeviceId,
  recordingDeviceOptions,
  recordingElapsedMs,
  recordingLevel,
  recordingPath,
  recordingState,
  selectedModelId,
  status,
  title,
  transcribeMode,
  whisperBin,
  onChangeActiveSection,
  onChangeFfmpegBin,
  onChangeFormat,
  onChangeDecodeProfile,
  onChangeInputMode,
  onChangeKeepTemp,
  onChangeLanguage,
  onChangeOutputLocation,
  onChangeRecordingDevice,
  onChangeSelectedModelId,
  onChangeTitle,
  onChangeTranscribeMode,
  onChangeWhisperBin,
  onChooseInput,
  onChooseModel,
  onChooseOutput,
  onClearTempFiles,
  onDeleteLibraryEntry,
  onDownloadModel,
  onUninstallModel,
  onExportSample,
  onOpenLibraryOutput,
  onRefreshLibrary,
  onRevealLibraryOutput,
  onRemoveInput,
  onDeleteRecording,
  onRecordAgain,
  onStartRecording,
  onStopRecording,
  onTranscribe,
  onUseRecording,
}: ITranscriptFormProps) => {
  const selectedCatalogModel = MODEL_CATALOG.find((item) => item.id === selectedModelId)
  const mediaFileName = input ? getFileName(input) : ''
  const hasLanguageModelMismatch =
    selectedCatalogModel && !selectedCatalogModel.multilingual && (language === 'th' || language === 'mixed-th-en')

  if (activeSection === 'library') {
    return (
      <LibraryPanel
        libraryEntries={libraryEntries}
        onChangeActiveSection={onChangeActiveSection}
        onDeleteLibraryEntry={onDeleteLibraryEntry}
        onOpenLibraryOutput={onOpenLibraryOutput}
        onRefreshLibrary={onRefreshLibrary}
        onRevealLibraryOutput={onRevealLibraryOutput}
      />
    )
  }

  if (activeSection === 'models') {
    return (
      <ModelManagerPanel
        downloadingModels={downloadingModels}
        installedModels={installedModels}
        model={model}
        selectedModelId={selectedModelId}
        uninstallingId={uninstallingId}
        onChangeActiveSection={onChangeActiveSection}
        onChangeSelectedModelId={onChangeSelectedModelId}
        onChooseModel={onChooseModel}
        onDownloadModel={onDownloadModel}
        onUninstallModel={onUninstallModel}
      />
    )
  }

  if (activeSection === 'permissions') {
    return <PermissionsPanel />
  }

  if (activeSection === 'settings') {
    return (
      <SettingsPanel
        engineStatus={engineStatus}
        ffmpegBin={ffmpegBin}
        keepTemp={keepTemp}
        outputLocation={outputLocation}
        recordingDeviceId={recordingDeviceId}
        recordingDeviceOptions={recordingDeviceOptions}
        whisperBin={whisperBin}
        onChangeFfmpegBin={onChangeFfmpegBin}
        onChangeKeepTemp={onChangeKeepTemp}
        onChangeOutputLocation={onChangeOutputLocation}
        onChangeRecordingDevice={onChangeRecordingDevice}
        onChangeWhisperBin={onChangeWhisperBin}
        onClearTempFiles={onClearTempFiles}
      />
    )
  }

  return (
    <Card className="panel-card transcribe-workspace-card">
      <CardHeader>
        <CardTitle>New transcript</CardTitle>
        <CardDescription>Local transcription workspace.</CardDescription>
      </CardHeader>
      <CardContent className="transcribe-content transcribe-workspace-content">
        <TranscribeSourcePanel
          input={input}
          inputMode={inputMode}
          mediaFileName={mediaFileName}
          recordingDeviceId={recordingDeviceId}
          recordingDeviceOptions={recordingDeviceOptions}
          recordingElapsedMs={recordingElapsedMs}
          recordingLevel={recordingLevel}
          recordingPath={recordingPath}
          recordingState={recordingState}
          status={status}
          onChangeInputMode={onChangeInputMode}
          onChangeRecordingDevice={onChangeRecordingDevice}
          onChooseInput={onChooseInput}
          onDeleteRecording={onDeleteRecording}
          onRecordAgain={onRecordAgain}
          onRemoveInput={onRemoveInput}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          onUseRecording={onUseRecording}
        />

        <div className="transcribe-workspace-grid">
          <TranscribeOptionsPanel
            decodeProfile={decodeProfile}
            language={language}
            title={title}
            transcribeMode={transcribeMode}
            onChangeDecodeProfile={onChangeDecodeProfile}
            onChangeLanguage={onChangeLanguage}
            onChangeTitle={onChangeTitle}
            onChangeTranscribeMode={onChangeTranscribeMode}
          />

          <TranscribeModelPanel
            hasLanguageModelMismatch={hasLanguageModelMismatch}
            installedModels={installedModels}
            model={model}
            selectedCatalogModel={selectedCatalogModel}
            selectedModelId={selectedModelId}
            onChangeActiveSection={onChangeActiveSection}
          />

          <TranscribeOutputPanel
            format={format}
            outputLocation={outputLocation}
            outputPath={outputPath}
            onChangeFormat={onChangeFormat}
            onChooseOutput={onChooseOutput}
          />
        </div>

        <TranscribeActionFooter
          canTranscribe={canTranscribe}
          status={status}
          onExportSample={onExportSample}
          onTranscribe={onTranscribe}
        />
      </CardContent>
    </Card>
  )
}

export { TranscriptForm }
