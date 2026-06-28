import { convertFileSrc } from '@tauri-apps/api/core'
import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from 'react'
import IconDownload from '~icons/lucide/download'
import IconFileAudio from '~icons/lucide/file-audio'
import IconFileText from '~icons/lucide/file-text'
import IconFolderDown from '~icons/lucide/folder-down'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconInfo from '~icons/lucide/info'
import IconMic from '~icons/lucide/mic'
import IconPause from '~icons/lucide/pause'
import IconPlay from '~icons/lucide/play'
import IconShieldCheck from '~icons/lucide/shield-check'
import IconTrash2 from '~icons/lucide/trash-2'
import { FORMAT_OPTIONS, MODEL_CATALOG, OUTPUT_LOCATION_OPTIONS } from '../constants'
import type {
  AppSection,
  ExportFormat,
  IEngineStatus,
  IMediaPreview,
  InputMode,
  IRecordingDeviceOption,
  ITranscribeProgress,
  JobState,
  OutputLocation,
  TranscribeMode,
} from '../types'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

interface ITranscriptFormProps {
  activeSection: AppSection
  canTranscribe: boolean
  engineStatus: IEngineStatus | null
  ffmpegBin: string
  format: ExportFormat
  input: string
  inputMode: InputMode
  keepTemp: boolean
  language: string
  model: string
  mediaPreview: IMediaPreview | null
  mediaPreviewError: string | null
  mediaPreviewLoading: boolean
  outputLocation: OutputLocation
  outputPath: string
  recordingDeviceId: string
  recordingDeviceOptions: IRecordingDeviceOption[]
  status: JobState
  transcribeProgress: ITranscribeProgress | null
  title: string
  transcribeMode: TranscribeMode
  whisperBin: string
  selectedModelId: string
  installedModels: Record<string, string>
  downloadingId: string | null
  uninstallingId: string | null
  downloadProgress: number
  onChangeSelectedModelId: (value: string) => void
  onDownloadModel: (id: string) => void
  onUninstallModel: (id: string) => void
  onChangeActiveSection: (value: AppSection) => void
  onChangeFfmpegBin: (value: string) => void
  onChangeFormat: (value: ExportFormat) => void
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
  onExportSample: () => void
  onTranscribe: () => void
  onRemoveInput: () => void
}

const getFileName = (path: string) => path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? ''

const TranscriptForm = ({
  activeSection,
  canTranscribe,
  downloadProgress,
  downloadingId,
  uninstallingId,
  engineStatus,
  ffmpegBin,
  format,
  input,
  inputMode,
  installedModels,
  keepTemp,
  language,
  model,
  mediaPreview,
  mediaPreviewError,
  mediaPreviewLoading,
  outputLocation,
  outputPath,
  recordingDeviceId,
  recordingDeviceOptions,
  selectedModelId,
  status,
  transcribeProgress,
  title,
  transcribeMode,
  whisperBin,
  onChangeActiveSection,
  onChangeFfmpegBin,
  onChangeFormat,
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
  onDownloadModel,
  onUninstallModel,
  onExportSample,
  onRemoveInput,
  onTranscribe,
}: ITranscriptFormProps) => {
  const selectedCatalogModel = MODEL_CATALOG.find((item) => item.id === selectedModelId)
  const mediaFileName = input ? getFileName(input) : ''
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0)
  const [previewDuration, setPreviewDuration] = useState(0)
  const audioSource = useMemo(() => (input ? convertFileSrc(input) : ''), [input])
  const previewDurationSeconds = previewDuration || (mediaPreview?.durationMs ? mediaPreview.durationMs / 1000 : 0)
  const previewProgressRatio = previewDurationSeconds > 0 ? previewCurrentTime / previewDurationSeconds : 0

  const seekPreviewPlayback = (clientX: number, target: HTMLElement) => {
    const audio = audioRef.current
    const duration = audio?.duration && Number.isFinite(audio.duration) ? audio.duration : previewDurationSeconds
    if (!audio || duration <= 0) return

    const rect = target.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const nextTime = ratio * duration
    audio.currentTime = nextTime
    setPreviewCurrentTime(nextTime)
  }

  const handleWavePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    seekPreviewPlayback(event.clientX, event.currentTarget)
  }

  const handleWavePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) return
    seekPreviewPlayback(event.clientX, event.currentTarget)
  }

  const handleWaveKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const duration = audio?.duration && Number.isFinite(audio.duration) ? audio.duration : previewDurationSeconds
    if (!audio || duration <= 0) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      void togglePreviewPlayback()
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 5 : -5
      const nextTime = Math.max(0, Math.min(duration, audio.currentTime + delta))
      audio.currentTime = nextTime
      setPreviewCurrentTime(nextTime)
    }
  }

  const togglePreviewPlayback = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      await audio.play()
      setIsPreviewPlaying(true)
    } else {
      audio.pause()
      setIsPreviewPlaying(false)
    }
  }

  if (activeSection === 'models') {
    return (
      <Card className="panel-card">
        <CardHeader>
          <CardTitle>Model manager</CardTitle>
          <CardDescription>
            Choose a Whisper model profile. Installed catalog models and custom local files can be used for
            transcription.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="custom-model-block">
            <div>
              <strong>Custom model file</strong>
              <p>Load a local `.bin` or `.gguf` file for the current transcription engine.</p>
            </div>
            <div className="custom-model-actions">
              {model ? (
                <span className="state-chip is-ready">Loaded</span>
              ) : (
                <span className="state-chip">Required</span>
              )}
              <Button onClick={onChooseModel} type="button" variant="secondary">
                <IconFolderOpen />
                {model ? 'Change file' : 'Select file'}
              </Button>
            </div>
          </div>
          {model ? <code className="path-line">{model}</code> : null}

          <div className="model-grid">
            {MODEL_CATALOG.map((item) => {
              const isSelected = selectedModelId === item.id
              const installedPath = installedModels[item.id]
              const isInstalled = Boolean(installedPath)
              const isDownloading = downloadingId === item.id
              const isUninstalling = uninstallingId === item.id

              return (
                <article className={isSelected ? 'model-card is-selected' : 'model-card'} key={item.id}>
                  <div className="model-card-head">
                    <strong>{item.name}</strong>
                    <div className="model-head-meta">
                      {isSelected ? <span className="state-chip is-selected-chip">Selected</span> : null}
                      <span>{item.sizeMb} MB</span>
                    </div>
                  </div>
                  <p>{item.description}</p>
                  <div className="model-card-meta">
                    <span>{item.speed}</span>
                    <span>{item.quality}</span>
                    <span>{item.multilingual ? 'Multilingual' : 'English'}</span>
                  </div>
                  <div className="model-card-footer">
                    {isInstalled ? (
                      <span className="state-chip is-ready">Installed</span>
                    ) : (
                      <span className="state-chip">Not installed</span>
                    )}
                    <div className="model-card-actions">
                      {isDownloading ? (
                        <span className="download-meter" role="progressbar" aria-label="Downloading model">
                          <span className={`download-progress-value progress-${downloadProgress}`} />
                        </span>
                      ) : isInstalled ? (
                        <>
                          <Button
                            onClick={() => {
                              onChangeSelectedModelId(item.id)
                              onChangeActiveSection('transcribe')
                            }}
                            size="sm"
                            type="button"
                            variant={isSelected ? 'default' : 'secondary'}
                          >
                            {isSelected ? 'Selected' : 'Use model'}
                          </Button>
                          <Button
                            disabled={isUninstalling}
                            onClick={() => onUninstallModel(item.id)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <IconTrash2 />
                            {isUninstalling ? 'Removing' : 'Remove'}
                          </Button>
                        </>
                      ) : (
                        <Button onClick={() => onDownloadModel(item.id)} size="sm" type="button" variant="secondary">
                          <IconDownload />
                          Install
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {selectedModelId !== 'custom' && !installedModels[selectedModelId] ? (
            <div className="notice-box">
              <IconInfo />
              <span>Install this model to use it for local transcription, or choose a Custom model file.</span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  if (activeSection === 'permissions') {
    return (
      <Card className="panel-card narrow-panel">
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>Preparation checklist for local capture and file export.</CardDescription>
        </CardHeader>
        <CardContent className="settings-stack">
          <div className="permission-row">
            <IconMic />
            <div>
              <strong>Microphone</strong>
              <p>Needed for direct recording after native capture is connected.</p>
            </div>
            <span className="state-chip">Setup</span>
          </div>
          <div className="permission-row">
            <IconFolderOpen />
            <div>
              <strong>Files and folders</strong>
              <p>Used for media import, model files, and writing transcripts to Downloads or a selected path.</p>
            </div>
            <span className="state-chip is-ready">Dialog access</span>
          </div>
          <div className="notice-box">
            <IconShieldCheck />
            <span>Permission checks are displayed as setup guidance until native status checks are added.</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activeSection === 'settings') {
    return (
      <Card className="panel-card narrow-panel">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Engine commands, output defaults, and capture preferences.</CardDescription>
        </CardHeader>
        <CardContent className="settings-stack">
          <div className="engine-status-card">
            <div>
              <strong>{engineStatus?.available ? 'Engine Ready' : 'Engine Missing'}</strong>
              <p>{engineStatus?.message ?? 'Checking whisper.cpp local engine...'}</p>
              {engineStatus?.binaryPath ? <code>{engineStatus.binaryPath}</code> : null}
            </div>
            <span className={engineStatus?.available ? 'state-chip is-ready' : 'state-chip'}>whisper.cpp local</span>
          </div>

          <div className="field-row">
            <span>Microphone source</span>
            <Select value={recordingDeviceId} onValueChange={onChangeRecordingDevice}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recordingDeviceOptions.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="field-row">
            <span>Default output</span>
            <Select value={outputLocation} onValueChange={(value) => onChangeOutputLocation(value as OutputLocation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_LOCATION_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="field-row">
            <span>ffmpeg command</span>
            <Input value={ffmpegBin} onChange={(event) => onChangeFfmpegBin(event.target.value)} />
          </div>

          <div className="field-row">
            <span>whisper.cpp command</span>
            <Input
              placeholder={engineStatus?.binaryPath ?? 'Auto-detect whisper-cli'}
              value={whisperBin}
              onChange={(event) => onChangeWhisperBin(event.target.value)}
            />
          </div>

          <label className="checkbox-row">
            <input checked={keepTemp} onChange={(event) => onChangeKeepTemp(event.target.checked)} type="checkbox" />
            <span>Keep intermediate audio files for debugging</span>
          </label>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="panel-card">
      <CardHeader>
        <CardTitle>New transcript</CardTitle>
        <CardDescription>Import a local file or prepare the recording workspace.</CardDescription>
      </CardHeader>
      <CardContent className="transcribe-content">
        {status === 'running' ? (
          <div className="transcribe-progress-card">
            <div className="progress-card-head">
              <div>
                <strong>{transcribeProgress?.message ?? 'Transcribing locally'}</strong>
                <p>
                  {transcribeProgress?.stage
                    ? `Stage: ${transcribeProgress.stage}`
                    : 'Normalizing audio and running whisper.cpp.'}
                </p>
              </div>
              <span>{Math.round(transcribeProgress?.percent ?? 0)}%</span>
            </div>
            <span className="progress-track" role="progressbar" aria-label="Transcription progress">
              <span style={{ width: `${Math.max(4, Math.min(100, transcribeProgress?.percent ?? 4))}%` }} />
            </span>
          </div>
        ) : null}

        <Tabs value={inputMode} onValueChange={(value) => onChangeInputMode(value as InputMode)}>
          <TabsList>
            <TabsTrigger value="file">
              <IconFileAudio />
              Import file
            </TabsTrigger>
            <TabsTrigger value="record">
              <IconMic />
              Record
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            {input ? (
              <div className="selected-source selected-source-with-preview">
                <IconFileAudio />
                <div>
                  <strong>{mediaFileName}</strong>
                  <code>{input}</code>
                  <div className="media-preview-strip">
                    {/* biome-ignore lint/a11y/useMediaCaption: local source preview is controlled by the generated transcript flow */}
                    <audio
                      ref={audioRef}
                      src={audioSource}
                      onEnded={() => setIsPreviewPlaying(false)}
                      onLoadedMetadata={(event) => {
                        setPreviewDuration(event.currentTarget.duration)
                        setPreviewCurrentTime(event.currentTarget.currentTime)
                      }}
                      onPause={() => setIsPreviewPlaying(false)}
                      onPlay={() => setIsPreviewPlaying(true)}
                      onTimeUpdate={(event) => setPreviewCurrentTime(event.currentTarget.currentTime)}
                    />
                    <Button onClick={() => void togglePreviewPlayback()} size="icon" type="button" variant="secondary">
                      {isPreviewPlaying ? <IconPause /> : <IconPlay />}
                    </Button>
                    <div
                      className="waveform-bars"
                      role="slider"
                      tabIndex={0}
                      aria-label="Audio preview position"
                      aria-valuemin={0}
                      aria-valuemax={Math.round(previewDurationSeconds)}
                      aria-valuenow={Math.round(previewCurrentTime)}
                      onKeyDown={handleWaveKeyDown}
                      onPointerDown={handleWavePointerDown}
                      onPointerMove={handleWavePointerMove}
                    >
                      {mediaPreview?.peaks.map((peak, index) => {
                        const isPlayed =
                          mediaPreview.peaks.length > 0 && index / mediaPreview.peaks.length <= previewProgressRatio

                        return (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: waveform bars are generated in stable order
                            key={index}
                            className={`wave-bar wave-${Math.max(1, Math.min(10, Math.round(peak * 10)))} ${isPlayed ? 'is-played' : ''}`}
                          />
                        )
                      })}
                      {mediaPreviewLoading
                        ? Array.from({ length: 32 }).map((_, index) => (
                            <span
                              // biome-ignore lint/suspicious/noArrayIndexKey: loading waveform placeholder is static
                              key={index}
                              className={`wave-bar wave-${(index % 6) + 2}`}
                            />
                          ))
                        : null}
                    </div>
                    <span className="media-duration">
                      {mediaPreview || previewDurationSeconds
                        ? `${formatDuration(previewCurrentTime * 1000)} / ${formatDuration(previewDurationSeconds * 1000)}`
                        : mediaPreviewLoading
                          ? 'Analyzing…'
                          : 'Preview'}
                    </span>
                  </div>
                  {mediaPreviewError ? <span className="media-preview-error">Preview unavailable</span> : null}
                </div>
                <Button onClick={onRemoveInput} size="sm" type="button" variant="ghost">
                  <IconTrash2 />
                  Remove
                </Button>
              </div>
            ) : (
              <button className="file-dropzone" onClick={onChooseInput} type="button">
                <IconFolderDown />
                <strong>Choose audio or video</strong>
                <span>MP3, WAV, M4A, MP4, MOV, MKV, WEBM</span>
              </button>
            )}
          </TabsContent>

          <TabsContent value="record">
            <div className="record-setup">
              <button className="record-button" type="button">
                <IconMic />
              </button>
              <div>
                <strong>Prepare recording</strong>
                <p>Choose a microphone and confirm capture settings before native recording is connected.</p>
              </div>
              <Select value={recordingDeviceId} onValueChange={onChangeRecordingDevice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recordingDeviceOptions.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <div className="form-grid">
          <div className="field-row">
            <span>Language</span>
            <Select value={language} onValueChange={onChangeLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mixed-th-en">Thai / English</SelectItem>
                <SelectItem value="th">Thai</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="auto">Auto detect</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="field-row">
            <span>Title</span>
            <Input placeholder="Weekly sync" value={title} onChange={(event) => onChangeTitle(event.target.value)} />
          </div>

          <div className="field-row form-grid-wide">
            <span>Transcribe mode</span>
            <Select value={transcribeMode} onValueChange={(value) => onChangeTranscribeMode(value as TranscribeMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single pass · best context</SelectItem>
                <SelectItem value="smart">Smart chunks · better progress for long files</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="model-summary-card">
          <IconFileText />
          <div>
            <span>Model</span>
            <strong>
              {selectedModelId === 'custom'
                ? model
                  ? getFileName(model)
                  : 'Custom model required'
                : selectedCatalogModel?.name}
            </strong>
            <p>
              {selectedModelId === 'custom'
                ? model || 'Select a local model file to run transcription.'
                : installedModels[selectedModelId] || 'Install this model before transcribing.'}
            </p>
          </div>
          <Button onClick={() => onChangeActiveSection('models')} size="sm" type="button" variant="secondary">
            Change
          </Button>
        </div>

        <div className="format-row">
          {FORMAT_OPTIONS.map((item) => (
            <Button
              className={format === item.value ? 'format-button is-selected' : 'format-button'}
              key={item.value}
              onClick={() => onChangeFormat(item.value)}
              size="sm"
              type="button"
              variant="secondary"
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="output-summary-card">
          <div>
            <span>Output</span>
            <strong>
              {outputLocation === 'downloads'
                ? 'Downloads / Otobun'
                : outputLocation === 'source-folder'
                  ? 'Source folder'
                  : 'Custom path'}
            </strong>
            <p>{outputPath || 'Files save to Downloads/Otobun unless you choose a path.'}</p>
          </div>
          <Button onClick={onChooseOutput} size="sm" type="button" variant="secondary">
            Choose path
          </Button>
        </div>

        <div className="action-row">
          <Button disabled={status === 'running'} onClick={onExportSample} type="button" variant="secondary">
            Load sample
          </Button>
          <Button disabled={status === 'running' || !canTranscribe} onClick={onTranscribe} type="button">
            {status === 'running' ? 'Working…' : 'Transcribe'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export { TranscriptForm }
