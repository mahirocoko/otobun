import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { downloadDir } from '@tauri-apps/api/path'
import { open, save } from '@tauri-apps/plugin-dialog'
import { useEffect, useMemo, useState } from 'react'
import IconDownload from '~icons/lucide/download'
import IconFileAudio from '~icons/lucide/file-audio'
import IconMic from '~icons/lucide/mic'
import IconSettings from '~icons/lucide/settings'
import logo from './assets/otobun-logo-selected.png'
import { HeroCard } from './components/hero-card'
import { PreviewCard } from './components/preview-card'
import { TranscriptForm } from './components/transcript-form'
import { Button } from './components/ui/button'
import {
  FORMAT_OPTIONS,
  MEDIA_EXTENSIONS,
  MODEL_CATALOG,
  MODEL_EXTENSIONS,
  RECORDING_DEVICE_OPTIONS,
} from './constants'
import type {
  AppSection,
  ExportFormat,
  ICommandResponse,
  IEngineStatus,
  IMediaPreview,
  IModelDownloadProgress,
  IModelFileResponse,
  InputMode,
  ITranscribeProgress,
  JobState,
  OutputLocation,
  TranscribeMode,
} from './types'
import { cn } from './utils/cn'

interface INavItem {
  value: AppSection
  label: string
  icon: typeof IconFileAudio
}

const NAV_ITEMS: INavItem[] = [
  { value: 'transcribe', label: 'Transcribe', icon: IconFileAudio },
  { value: 'models', label: 'Models', icon: IconDownload },
  { value: 'permissions', label: 'Permissions', icon: IconMic },
  { value: 'settings', label: 'Settings', icon: IconSettings },
]

const getFileStem = (path: string) => {
  const name = path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? ''
  return name.replace(/\.[^.]+$/, '')
}

const getSuggestedOutputName = (input: string, format: ExportFormat) => {
  const option = FORMAT_OPTIONS.find((item) => item.value === format)
  const stem = getFileStem(input) || 'otobun-transcript'
  return `${stem}.${option?.extension ?? format}`
}

const getSourceFolder = (path: string) => {
  const normalized = path.replaceAll('\\', '/')
  const parts = normalized.split('/')
  parts.pop()
  return parts.join('/')
}

const resolveDefaultOutputPath = async (input: string, format: ExportFormat, outputLocation: OutputLocation) => {
  const fileName = getSuggestedOutputName(input, format)

  if (outputLocation === 'source-folder' && input.trim()) {
    const folder = getSourceFolder(input)
    if (folder) return `${folder}/${fileName}`
  }

  const downloadsPath = await downloadDir()
  return `${downloadsPath}/Otobun/${fileName}`
}

const App = () => {
  // _State
  const [activeSection, setActiveSection] = useState<AppSection>('transcribe')
  const [inputMode, setInputMode] = useState<InputMode>('file')
  const [input, setInput] = useState('')
  const [model, setModel] = useState('')
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
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<JobState>('idle')
  const [message, setMessage] = useState('Ready')
  const [engineStatus, setEngineStatus] = useState<IEngineStatus | null>(null)
  const [transcribeProgress, setTranscribeProgress] = useState<ITranscribeProgress | null>(null)
  const [mediaPreview, setMediaPreview] = useState<IMediaPreview | null>(null)
  const [mediaPreviewLoading, setMediaPreviewLoading] = useState(false)
  const [mediaPreviewError, setMediaPreviewError] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string>('custom')
  const [installedModels, setInstalledModels] = useState<Record<string, string>>({})
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [uninstallingId, setUninstallingId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // _Effects
  useEffect(() => {
    const syncEngineStatus = async () => {
      try {
        const status = await invoke<IEngineStatus>('get_engine_status')
        setEngineStatus(status)
        if (status.binaryPath && !whisperBin.trim()) setWhisperBin(status.binaryPath)
      } catch (error) {
        setEngineStatus({ available: false, binaryPath: null, version: null, message: String(error) })
      }
    }

    void syncEngineStatus()
  }, [whisperBin])

  useEffect(() => {
    const syncInstalledModels = async () => {
      try {
        const responses = await invoke<IModelFileResponse[]>('list_models', {
          requests: MODEL_CATALOG.map((item) => ({ id: item.id, fileName: item.fileName })),
        })
        setInstalledModels(Object.fromEntries(responses.map((item) => [item.id, item.path])))
      } catch (error) {
        setMessage(`Model check failed: ${String(error)}`)
      }
    }

    void syncInstalledModels()
  }, [])

  useEffect(() => {
    const unlisten = listen<IModelDownloadProgress>('model-download-progress', (event) => {
      const progress = event.payload.percent ?? (event.payload.state === 'starting' ? 2 : 10)
      setDownloadProgress(Math.max(0, Math.min(100, Math.round(progress / 10) * 10)))
    })

    return () => {
      void unlisten.then((dispose) => dispose())
    }
  }, [])

  useEffect(() => {
    const unlisten = listen<ITranscribeProgress>('transcribe-progress', (event) => {
      setTranscribeProgress(event.payload)
    })

    return () => {
      void unlisten.then((dispose) => dispose())
    }
  }, [])

  useEffect(() => {
    if (!input.trim()) {
      setMediaPreview(null)
      setMediaPreviewError(null)
      setMediaPreviewLoading(false)
      return
    }

    let isActive = true
    const loadMediaPreview = async () => {
      setMediaPreviewLoading(true)
      setMediaPreviewError(null)
      try {
        const preview = await invoke<IMediaPreview>('get_media_preview', {
          request: { path: input, ffmpegBin: ffmpegBin.trim() || null, barCount: 64 },
        })
        if (isActive) setMediaPreview(preview)
      } catch (error) {
        if (isActive) {
          setMediaPreview(null)
          setMediaPreviewError(String(error))
        }
      } finally {
        if (isActive) setMediaPreviewLoading(false)
      }
    }

    void loadMediaPreview()
    return () => {
      isActive = false
    }
  }, [input, ffmpegBin])

  // _Computed
  const selectedModelPath = selectedModelId === 'custom' ? model.trim() : installedModels[selectedModelId]
  const canTranscribe = input.trim().length > 0 && Boolean(selectedModelPath)
  const selectedFormat = useMemo(() => FORMAT_OPTIONS.find((item) => item.value === format), [format])

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
  const handleDownloadModel = async (id: string) => {
    const catalogItem = MODEL_CATALOG.find((item) => item.id === id)
    if (!catalogItem) return

    setDownloadingId(id)
    setDownloadProgress(0)
    setMessage(`Downloading ${catalogItem.name}`)

    try {
      const response = await invoke<IModelFileResponse>('download_model', {
        request: { id: catalogItem.id, fileName: catalogItem.fileName },
      })
      setInstalledModels((current) => ({ ...current, [response.id]: response.path }))
      setSelectedModelId(response.id)
      setDownloadProgress(100)
      setMessage(`${catalogItem.name} installed`)
    } catch (error) {
      setStatus('error')
      setMessage(String(error))
    } finally {
      setDownloadingId(null)
      setDownloadProgress(0)
    }
  }

  const handleUninstallModel = async (id: string) => {
    const catalogItem = MODEL_CATALOG.find((item) => item.id === id)
    if (!catalogItem) return

    setUninstallingId(id)
    setMessage(`Removing ${catalogItem.name}`)

    try {
      await invoke('uninstall_model', {
        request: { id: catalogItem.id, fileName: catalogItem.fileName },
      })
      setInstalledModels((current) => {
        const nextModels = { ...current }
        delete nextModels[id]
        return nextModels
      })
      if (selectedModelId === id) setSelectedModelId('custom')
      setMessage(`${catalogItem.name} removed`)
    } catch (error) {
      setStatus('error')
      setMessage(String(error))
    } finally {
      setUninstallingId(null)
    }
  }

  const runSample = async () => {
    setOutput('')
    setTranscribeProgress({ stage: 'sample', message: 'Generating sample transcript', percent: 20 })
    setStatus('running')
    setMessage('Generating sample')
    try {
      const finalOutputPath = outputPath.trim() || (await resolveDefaultOutputPath(input, format, outputLocation))
      const response = await invoke<ICommandResponse>('export_sample', {
        request: {
          format,
          outputPath: finalOutputPath,
        },
      })
      setOutput(response.output)
      setStatus('done')
      setTranscribeProgress(null)
      setMessage(response.wroteTo ? `Saved to ${response.wroteTo}` : 'Sample loaded')
    } catch (error) {
      setStatus('error')
      setTranscribeProgress(null)
      setMessage(String(error))
    }
  }

  const runTranscribe = async () => {
    if (!canTranscribe) {
      setStatus('error')
      setMessage('Choose media and an installed or custom model first')
      return
    }

    setOutput('')
    setTranscribeProgress({ stage: 'queued', message: 'Starting transcription', percent: 1 })
    setStatus('running')
    setMessage('Transcribing locally')
    try {
      const finalLanguage = language === 'mixed-th-en' ? 'auto' : language
      const finalOutputPath = outputPath.trim() || (await resolveDefaultOutputPath(input, format, outputLocation))

      const response = await invoke<ICommandResponse>('transcribe', {
        request: {
          input: input.trim(),
          model: selectedModelPath,
          format,
          title: title.trim() || null,
          language: finalLanguage.trim() || null,
          ffmpegBin: ffmpegBin.trim() || null,
          whisperBin: whisperBin.trim() || null,
          keepTemp,
          outputPath: finalOutputPath,
          chunkMode: transcribeMode,
        },
      })
      setOutput(response.output)
      setStatus('done')
      setTranscribeProgress(null)
      setMessage(response.wroteTo ? `Saved to ${response.wroteTo}` : 'Transcription complete')
    } catch (error) {
      setStatus('error')
      setTranscribeProgress(null)
      setMessage(String(error))
    }
  }

  const copyOutput = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setMessage('Copied')
  }

  const removeInput = () => {
    setInput('')
    setTitle('')
    setMediaPreview(null)
    setMediaPreviewError(null)
    setMessage('Media removed')
  }

  const startNewTranscript = () => {
    setInput('')
    setTitle('')
    setMediaPreview(null)
    setMediaPreviewError(null)
    setOutput('')
    setOutputPath('')
    setStatus('idle')
    setActiveSection('transcribe')
    setMessage('Ready for a new transcript')
  }

  // _Render
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img alt="Otobun" className="brand-logo" src={logo} />
          <div>
            <strong>Otobun</strong>
            <span>local transcript desk</span>
          </div>
        </div>

        <nav aria-label="Main navigation" className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon

            return (
              <Button
                className={cn('sidebar-link', activeSection === item.value && 'is-active')}
                key={item.value}
                onClick={() => setActiveSection(item.value)}
                type="button"
                variant="ghost"
              >
                <Icon />
                {item.label}
              </Button>
            )
          })}
        </nav>
      </aside>

      <main className="app-main">
        <HeroCard activeSection={activeSection} message={message} status={status} />
        <section className={activeSection === 'transcribe' ? 'workspace-flow' : 'workspace-single'}>
          {activeSection === 'transcribe' && output ? (
            <PreviewCard format={format} output={output} onCopy={copyOutput} onNewTranscript={startNewTranscript} />
          ) : (
            <TranscriptForm
              activeSection={activeSection}
              canTranscribe={canTranscribe}
              downloadProgress={downloadProgress}
              downloadingId={downloadingId}
              uninstallingId={uninstallingId}
              engineStatus={engineStatus}
              ffmpegBin={ffmpegBin}
              format={format}
              input={input}
              inputMode={inputMode}
              installedModels={installedModels}
              keepTemp={keepTemp}
              language={language}
              model={model}
              mediaPreview={mediaPreview}
              mediaPreviewError={mediaPreviewError}
              mediaPreviewLoading={mediaPreviewLoading}
              outputLocation={outputLocation}
              outputPath={outputPath}
              recordingDeviceId={recordingDeviceId}
              recordingDeviceOptions={RECORDING_DEVICE_OPTIONS}
              selectedModelId={selectedModelId}
              status={status}
              transcribeProgress={transcribeProgress}
              title={title}
              transcribeMode={transcribeMode}
              whisperBin={whisperBin}
              onChangeActiveSection={setActiveSection}
              onChangeFfmpegBin={setFfmpegBin}
              onChangeFormat={setFormat}
              onChangeInputMode={setInputMode}
              onChangeKeepTemp={setKeepTemp}
              onChangeLanguage={setLanguage}
              onChangeOutputLocation={setOutputLocation}
              onChangeRecordingDevice={setRecordingDeviceId}
              onChangeSelectedModelId={setSelectedModelId}
              onChangeTitle={setTitle}
              onChangeTranscribeMode={setTranscribeMode}
              onChangeWhisperBin={setWhisperBin}
              onChooseInput={chooseInput}
              onChooseModel={chooseModel}
              onChooseOutput={chooseOutput}
              onDownloadModel={(id: string) => void handleDownloadModel(id)}
              onUninstallModel={(id: string) => void handleUninstallModel(id)}
              onExportSample={runSample}
              onRemoveInput={removeInput}
              onTranscribe={runTranscribe}
            />
          )}
        </section>
      </main>
    </div>
  )
}

export { App }
