import { invoke } from '@tauri-apps/api/core'
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
import type { AppSection, ExportFormat, ICommandResponse, InputMode, JobState, OutputLocation } from './types'
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
  return `${downloadsPath}/${fileName}`
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
  const [outputPath, setOutputPath] = useState('')
  const [ffmpegBin, setFfmpegBin] = useState('ffmpeg')
  const [whisperBin, setWhisperBin] = useState('whisper-cli')
  const [keepTemp, setKeepTemp] = useState(false)
  const [recordingDeviceId, setRecordingDeviceId] = useState(RECORDING_DEVICE_OPTIONS[0]?.id ?? 'system-default')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<JobState>('idle')
  const [message, setMessage] = useState('Ready')
  const [selectedModelId, setSelectedModelId] = useState<string>('custom')
  const [installedModels, setInstalledModels] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODEL_CATALOG.map((item) => [item.id, false])),
  )
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // _Effects
  useEffect(() => {
    if (downloadingId === null) return

    const interval = setInterval(() => {
      setDownloadProgress((previous) => {
        if (previous >= 100) {
          clearInterval(interval)
          setInstalledModels((current) => ({ ...current, [downloadingId]: true }))
          setDownloadingId(null)
          return 0
        }

        return previous + 10
      })
    }, 200)

    return () => clearInterval(interval)
  }, [downloadingId])

  // _Computed
  const canTranscribe = input.trim().length > 0 && selectedModelId === 'custom' && model.trim().length > 0
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
  const handleDownloadModel = (id: string) => {
    setDownloadingId(id)
    setDownloadProgress(0)
  }

  const runSample = async () => {
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
      setMessage(response.wroteTo ? `Saved to ${response.wroteTo}` : 'Sample loaded')
    } catch (error) {
      setStatus('error')
      setMessage(String(error))
    }
  }

  const runTranscribe = async () => {
    if (!canTranscribe) {
      setStatus('error')
      setMessage('Choose media and a custom local model first')
      return
    }

    setStatus('running')
    setMessage('Transcribing locally')
    try {
      const finalLanguage = language === 'mixed-th-en' ? 'auto' : language
      const finalOutputPath = outputPath.trim() || (await resolveDefaultOutputPath(input, format, outputLocation))

      const response = await invoke<ICommandResponse>('transcribe', {
        request: {
          input: input.trim(),
          model: model.trim(),
          format,
          title: title.trim() || null,
          language: finalLanguage.trim() || null,
          ffmpegBin: ffmpegBin.trim() || null,
          whisperBin: whisperBin.trim() || null,
          keepTemp,
          outputPath: finalOutputPath,
        },
      })
      setOutput(response.output)
      setStatus('done')
      setMessage(response.wroteTo ? `Saved to ${response.wroteTo}` : 'Transcription complete')
    } catch (error) {
      setStatus('error')
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
    setMessage('Media removed')
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
        <section className={activeSection === 'transcribe' ? 'workspace-grid' : 'workspace-single'}>
          <TranscriptForm
            activeSection={activeSection}
            canTranscribe={canTranscribe}
            downloadProgress={downloadProgress}
            downloadingId={downloadingId}
            ffmpegBin={ffmpegBin}
            format={format}
            input={input}
            inputMode={inputMode}
            installedModels={installedModels}
            keepTemp={keepTemp}
            language={language}
            model={model}
            outputLocation={outputLocation}
            outputPath={outputPath}
            recordingDeviceId={recordingDeviceId}
            recordingDeviceOptions={RECORDING_DEVICE_OPTIONS}
            selectedModelId={selectedModelId}
            status={status}
            title={title}
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
            onChangeWhisperBin={setWhisperBin}
            onChooseInput={chooseInput}
            onChooseModel={chooseModel}
            onChooseOutput={chooseOutput}
            onDownloadModel={handleDownloadModel}
            onExportSample={runSample}
            onRemoveInput={removeInput}
            onTranscribe={runTranscribe}
          />
          {activeSection === 'transcribe' ? <PreviewCard format={format} output={output} onCopy={copyOutput} /> : null}
        </section>
      </main>
    </div>
  )
}

export { App }
