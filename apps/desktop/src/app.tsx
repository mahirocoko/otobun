import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open, save } from '@tauri-apps/plugin-dialog'
import { useEffect, useMemo, useState } from 'react'
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
import { useModelPreference, writeModelPreference } from './hooks/use-model-preference'
import { useTranscriptionJob } from './hooks/use-transcription-job'
import type {
  AppSection,
  ExportFormat,
  IClearTempFilesResponse,
  InputMode,
  IRecordingDeviceOption,
  IRecordingLevelEvent,
  IRecordingResponse,
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
  const [recordingDeviceOptions, setRecordingDeviceOptions] =
    useState<IRecordingDeviceOption[]>(RECORDING_DEVICE_OPTIONS)
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'saving' | 'review'>('idle')
  const [lastRecordingPath, setLastRecordingPath] = useState('')
  const [recordingLevel, setRecordingLevel] = useState<IRecordingLevelEvent>({ peak: 0, rms: 0 })
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0)
  const [message, setMessage] = useState('Ready')

  // _Hooks
  const { model, selectedModelId, setModel, setSelectedModelId } = useModelPreference()
  const engineStatus = useEngineStatus(whisperBin, setWhisperBin)
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

  useEffect(() => {
    invoke<IRecordingDeviceOption[]>('list_recording_devices')
      .then((devices) => {
        if (devices.length === 0) return
        setRecordingDeviceOptions(devices)
        if (!devices.some((device) => device.id === recordingDeviceId)) {
          setRecordingDeviceId(devices[0]?.id ?? 'system-default')
        }
      })
      .catch((error) => setMessage(String(error)))
  }, [recordingDeviceId])

  useEffect(() => {
    const unlisten = listen<IRecordingLevelEvent>('recording-level', (event) => {
      setRecordingLevel(event.payload)
    })

    return () => {
      void unlisten.then((dispose) => dispose())
    }
  }, [])

  useEffect(() => {
    if (recordingState !== 'recording' || recordingStartedAt === null) return
    const interval = window.setInterval(() => {
      setRecordingElapsedMs(Date.now() - recordingStartedAt)
    }, 250)

    return () => window.clearInterval(interval)
  }, [recordingStartedAt, recordingState])

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
    setMessage('Media removed')
  }

  const startNewTranscript = () => {
    setInput('')
    setTitle('')
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

  const startRecording = async (force = false) => {
    if (!force && recordingState !== 'idle') return
    setRecordingState('saving')
    setRecordingLevel({ peak: 0, rms: 0 })
    setMessage('Preparing microphone')
    try {
      const response = await invoke<IRecordingResponse>('start_recording', {
        request: { deviceId: recordingDeviceId },
      })
      setRecordingState(response.active ? 'recording' : 'idle')
      setRecordingStartedAt(response.active ? Date.now() : null)
      setRecordingElapsedMs(0)
      if (response.path) setLastRecordingPath(response.path)
      setMessage(response.message)
    } catch (error) {
      setRecordingState('idle')
      setRecordingStartedAt(null)
      setRecordingElapsedMs(0)
      setMessage(String(error))
    }
  }

  const stopRecording = async () => {
    if (recordingState !== 'recording') return
    setRecordingState('saving')
    setMessage('Saving recording')
    try {
      const response = await invoke<IRecordingResponse>('stop_recording')
      setRecordingState('review')
      setRecordingStartedAt(null)
      setRecordingElapsedMs(response.durationMs ?? recordingElapsedMs)
      if (response.path) {
        setLastRecordingPath(response.path)
        if (!title.trim()) setTitle(getFileStem(response.path))
      }
      setMessage(response.path ? `${response.message}: ${response.path}` : response.message)
    } catch (error) {
      setRecordingState('idle')
      setRecordingStartedAt(null)
      setMessage(String(error))
    }
  }

  const useRecording = () => {
    if (!lastRecordingPath) return
    setInput(lastRecordingPath)
    setInputMode('file')
    setRecordingState('idle')
    setRecordingStartedAt(null)
    if (!title.trim()) setTitle(getFileStem(lastRecordingPath))
    setMessage('Recording selected for transcription')
  }

  const deleteRecordingDraft = async () => {
    if (!lastRecordingPath) return
    try {
      await invoke('delete_recording', { request: { path: lastRecordingPath } })
      if (input === lastRecordingPath) setInput('')
      setLastRecordingPath('')
      setRecordingState('idle')
      setRecordingLevel({ peak: 0, rms: 0 })
      setRecordingStartedAt(null)
      setRecordingElapsedMs(0)
      setMessage('Recording draft deleted')
    } catch (error) {
      setMessage(String(error))
    }
  }

  const recordAgain = async () => {
    if (lastRecordingPath) {
      try {
        await invoke('delete_recording', { request: { path: lastRecordingPath } })
      } catch (error) {
        setMessage(String(error))
        return
      }
    }
    setLastRecordingPath('')
    setRecordingState('idle')
    setRecordingStartedAt(null)
    setRecordingElapsedMs(0)
    await startRecording(true)
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
    onDeleteRecording: () => void deleteRecordingDraft(),
    onRecordAgain: () => void recordAgain(),
    onStartRecording: () => void startRecording(),
    onStopRecording: () => void stopRecording(),
    onTranscribe: () => void runTranscribe(),
    onUninstallModel: (id: string) => void installedModelState.uninstallModel(id),
    outputLocation,
    outputPath,
    recordingDeviceId,
    recordingDeviceOptions,
    recordingElapsedMs,
    recordingLevel,
    recordingPath: lastRecordingPath,
    recordingState,
    selectedModelId,
    status: transcriptionJob.status,
    title,
    transcribeMode,
    transcribeProgress: transcriptionJob.transcribeProgress,
    uninstallingId: installedModelState.uninstallingId,
    onUseRecording: useRecording,
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
