import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { useMemo, useState } from 'react'
import { AppSidebar } from './components/app-sidebar'
import { HeroCard } from './components/hero-card'
import { TranscribeWorkspace } from './components/transcribe/transcribe-workspace'
import { TranscriptForm } from './components/transcript-form'
import {
  FORMAT_OPTIONS,
  MEDIA_EXTENSIONS,
  MODEL_CATALOG,
  MODEL_EXTENSIONS,
  RECORDING_DEVICE_OPTIONS,
} from './constants'
import { useEngineStatus } from './hooks/use-engine-status'
import { useInstalledModels } from './hooks/use-installed-models'
import { useMediaPreview } from './hooks/use-media-preview'
import { useModelPreference, writeModelPreference } from './hooks/use-model-preference'
import { useTranscriptionJob } from './hooks/use-transcription-job'
import type {
  AppSection,
  ExportFormat,
  IClearTempFilesResponse,
  InputMode,
  OutputLocation,
  TranscribeMode,
} from './types'
import { getFileName, getFileStem, resolveDefaultOutputPath } from './utils/paths'

const App = () => {
  // _State
  const [activeSection, setActiveSection] = useState<AppSection>('transcribe')
  const [inputMode, setInputMode] = useState<InputMode>('file')
  const [input, setInput] = useState('')
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('mixed-th-en')
  const [format, setFormat] = useState<ExportFormat>('md')
  const [outputLocation, setOutputLocation] = useState<OutputLocation>('downloads')
  const [transcribeMode, setTranscribeMode] = useState<TranscribeMode>('single')
  const [outputPath, setOutputPath] = useState('')
  const [ffmpegBin, setFfmpegBin] = useState('ffmpeg')
  const [whisperBin, setWhisperBin] = useState('')
  const [keepTemp, setKeepTemp] = useState(false)
  const [recordingDeviceId, setRecordingDeviceId] = useState(RECORDING_DEVICE_OPTIONS[0]?.id ?? 'system-default')
  const [message, setMessage] = useState('Ready')

  // _Hooks
  const { model, selectedModelId, setModel, setSelectedModelId } = useModelPreference()
  const engineStatus = useEngineStatus(whisperBin, setWhisperBin)
  const { clearMediaPreview, mediaPreview, mediaPreviewError, mediaPreviewLoading } = useMediaPreview(input, ffmpegBin)
  const transcriptionJob = useTranscriptionJob(setMessage)
  const installedModelState = useInstalledModels({
    customModelPath: model,
    onError: (errorMessage) => {
      transcriptionJob.setStatus('error')
      setMessage(errorMessage)
    },
    onFallbackToCustom: () => {
      setSelectedModelId('custom')
      writeModelPreference({ selectedModelId: 'custom', customModelPath: model })
    },
    onMessage: setMessage,
    onSelectModel: setSelectedModelId,
    selectedModelId,
  })

  // _Computed
  const canTranscribe = input.trim().length > 0 && Boolean(installedModelState.selectedModelPath)
  const selectedFormat = useMemo(() => FORMAT_OPTIONS.find((item) => item.value === format), [format])
  const workspaceClassName =
    activeSection === 'transcribe' && transcriptionJob.output
      ? 'workspace-flow workspace-output'
      : activeSection === 'transcribe'
        ? 'workspace-flow'
        : 'workspace-single'

  const selectedCatalogModel = MODEL_CATALOG.find((item) => item.id === selectedModelId)
  const progressContext = {
    fileName: getFileName(input),
    modelName:
      selectedModelId === 'custom'
        ? getFileName(model) || 'Custom model'
        : selectedCatalogModel?.name || 'Selected model',
    modeLabel: transcribeMode === 'smart' ? 'Smart chunks' : 'Single pass',
    languageLabel: language === 'mixed-th-en' ? 'Thai / English' : language === 'auto' ? 'Auto detect' : language,
    formatLabel: selectedFormat?.label ?? format.toUpperCase(),
    outputLabel:
      outputLocation === 'downloads'
        ? 'Downloads / Otobun'
        : outputLocation === 'source-folder'
          ? 'Source folder'
          : 'Custom path',
  }

  // _Dialog
  const chooseInput = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Audio and video', extensions: MEDIA_EXTENSIONS }],
    })

    if (typeof selected !== 'string') return
    setInput(selected)
    if (!title.trim()) setTitle(getFileStem(selected))
    setMessage('Media selected')
  }

  const chooseModel = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Whisper models', extensions: MODEL_EXTENSIONS }],
    })

    if (typeof selected !== 'string') return
    setSelectedModelId('custom')
    setModel(selected)
    setActiveSection('transcribe')
    setMessage('Custom model selected')
  }

  const chooseOutput = async () => {
    const selected = await save({
      defaultPath: await resolveDefaultOutputPath(input, format, outputLocation),
      filters: [
        {
          name: selectedFormat?.label ?? 'Transcript',
          extensions: [selectedFormat?.extension ?? format],
        },
      ],
    })

    if (typeof selected !== 'string') return
    setOutputLocation('custom')
    setOutputPath(selected)
    setMessage('Output destination set')
  }

  // _Actions
  const removeInput = () => {
    setInput('')
    setTitle('')
    clearMediaPreview()
    setMessage('Media removed')
  }

  const startNewTranscript = () => {
    setInput('')
    setTitle('')
    clearMediaPreview()
    transcriptionJob.resetJob()
    setOutputPath('')
    setActiveSection('transcribe')
    setMessage('Ready for a new transcript')
  }

  const runSample = () =>
    transcriptionJob.runSample({
      format,
      input,
      outputLocation,
      outputPath,
    })

  const runTranscribe = () =>
    transcriptionJob.runTranscribe({
      ffmpegBin,
      format,
      input,
      keepTemp,
      language,
      modelPath: installedModelState.selectedModelPath,
      outputLocation,
      outputPath,
      title,
      transcribeMode,
      whisperBin,
    })

  const clearTempFiles = async () => {
    try {
      const response = await invoke<IClearTempFilesResponse>('clear_temp_files')
      setMessage(response.removed > 0 ? `Cleared ${response.removed} temp folder(s)` : 'No Otobun temp files to clear')
    } catch (error) {
      setMessage(String(error))
    }
  }

  const commonFormProps = {
    activeSection,
    canTranscribe,
    downloadingModels: installedModelState.downloadingModels,
    engineStatus,
    ffmpegBin,
    format,
    input,
    inputMode,
    installedModels: installedModelState.installedModels,
    keepTemp,
    language,
    mediaPreview,
    mediaPreviewError,
    mediaPreviewLoading,
    model,
    onChangeActiveSection: setActiveSection,
    onChangeFfmpegBin: setFfmpegBin,
    onChangeFormat: setFormat,
    onChangeInputMode: setInputMode,
    onChangeKeepTemp: setKeepTemp,
    onChangeLanguage: setLanguage,
    onChangeOutputLocation: setOutputLocation,
    onChangeRecordingDevice: setRecordingDeviceId,
    onChangeSelectedModelId: setSelectedModelId,
    onChangeTitle: setTitle,
    onChangeTranscribeMode: setTranscribeMode,
    onChangeWhisperBin: setWhisperBin,
    onChooseInput: chooseInput,
    onChooseModel: chooseModel,
    onChooseOutput: chooseOutput,
    onClearTempFiles: () => void clearTempFiles(),
    onDownloadModel: (id: string) => void installedModelState.downloadModel(id),
    onExportSample: () => void runSample(),
    onRemoveInput: removeInput,
    onTranscribe: () => void runTranscribe(),
    onUninstallModel: (id: string) => void installedModelState.uninstallModel(id),
    outputLocation,
    outputPath,
    recordingDeviceId,
    recordingDeviceOptions: RECORDING_DEVICE_OPTIONS,
    selectedModelId,
    status: transcriptionJob.status,
    title,
    transcribeMode,
    transcribeProgress: transcriptionJob.transcribeProgress,
    uninstallingId: installedModelState.uninstallingId,
    whisperBin,
  }

  // _Render
  return (
    <div className="app-shell">
      <AppSidebar activeSection={activeSection} onChangeSection={setActiveSection} />
      <main className="app-main">
        <HeroCard activeSection={activeSection} message={message} status={transcriptionJob.status} />
        <section className={workspaceClassName}>
          {activeSection === 'transcribe' ? (
            <TranscribeWorkspace
              {...commonFormProps}
              activityLog={transcriptionJob.activityLog}
              isCancelling={transcriptionJob.isCancelling}
              output={transcriptionJob.output}
              transcript={transcriptionJob.transcript}
              progressContext={progressContext}
              resultMeta={transcriptionJob.resultMeta}
              onCancelTranscribe={() => void transcriptionJob.cancelTranscribe()}
              onCopyOutput={() => void transcriptionJob.copyOutput()}
              onNewTranscript={startNewTranscript}
            />
          ) : (
            <TranscriptForm {...commonFormProps} />
          )}
        </section>
      </main>
    </div>
  )
}

export { App }
