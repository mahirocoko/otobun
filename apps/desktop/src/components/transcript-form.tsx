import { useState } from 'react'
import IconDownload from '~icons/lucide/download'
import IconExternalLink from '~icons/lucide/external-link'
import IconFileAudio from '~icons/lucide/file-audio'
import IconFileText from '~icons/lucide/file-text'
import IconFolderDown from '~icons/lucide/folder-down'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconInfo from '~icons/lucide/info'
import IconMic from '~icons/lucide/mic'
import IconPause from '~icons/lucide/pause'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconShieldCheck from '~icons/lucide/shield-check'
import IconTrash2 from '~icons/lucide/trash-2'
import { FORMAT_OPTIONS, MODEL_CATALOG, OUTPUT_LOCATION_OPTIONS } from '../constants'
import type {
  AppSection,
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
import { AudioWaveformPlayer } from './audio-waveform-player'
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

const getFileName = (path: string) => path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? ''

const formatClock = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatLibraryDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  })
}

const formatLibraryDuration = (durationMs?: number | null) => {
  if (!durationMs) return 'Unknown duration'
  return formatClock(durationMs)
}

const TranscriptForm = ({
  activeSection,
  canTranscribe,
  downloadingModels,
  uninstallingId,
  engineStatus,
  ffmpegBin,
  format,
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
  const [showAllModels, setShowAllModels] = useState(false)

  if (activeSection === 'library') {
    return (
      <Card className="panel-card library-panel">
        <CardHeader className="library-header">
          <div>
            <CardTitle>History</CardTitle>
            <CardDescription>
              Local transcript records saved on this Mac. Files stay where you exported them.
            </CardDescription>
          </div>
          <Button onClick={onRefreshLibrary} size="sm" type="button" variant="secondary">
            <IconRefreshCw />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {libraryEntries.length > 0 ? (
            <div className="library-list">
              {libraryEntries.map((entry) => (
                <article className="library-row" key={entry.id}>
                  <div className="library-row-main">
                    <div className="library-row-title">
                      <IconFileText />
                      <div>
                        <strong>{entry.title}</strong>
                        <span>{formatLibraryDate(entry.createdAt)}</span>
                      </div>
                    </div>
                    <div className="library-paths">
                      <code title={entry.sourcePath}>Source · {entry.sourcePath}</code>
                      <code title={entry.outputPath}>Output · {entry.outputPath}</code>
                    </div>
                    <div className="library-meta-row">
                      <span>{entry.modelLabel}</span>
                      <span>{entry.language}</span>
                      <span>{entry.format.toUpperCase()}</span>
                      <span>{entry.transcribeMode === 'smart' ? 'Smart chunks' : 'Single pass'}</span>
                      <span>{formatLibraryDuration(entry.durationMs)}</span>
                      <span>{entry.segmentCount} segments</span>
                    </div>
                  </div>
                  <div className="library-row-actions">
                    <Button onClick={() => onOpenLibraryOutput(entry.id)} size="sm" type="button" variant="secondary">
                      <IconExternalLink />
                      Open
                    </Button>
                    <Button onClick={() => onRevealLibraryOutput(entry.id)} size="sm" type="button" variant="ghost">
                      <IconFolderOpen />
                      Reveal
                    </Button>
                    <Button onClick={() => onDeleteLibraryEntry(entry.id)} size="sm" type="button" variant="ghost">
                      <IconTrash2 />
                      Delete entry
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="library-empty-state">
              <IconFileText />
              <strong>No transcripts yet</strong>
              <p>Transcribe a file or recording and Otobun will keep a local history entry here.</p>
              <Button onClick={() => onChangeActiveSection('transcribe')} type="button">
                Start transcribing
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (activeSection === 'models') {
    const recommendedModels = MODEL_CATALOG.filter((item) => item.recommended)
    const otherModels = MODEL_CATALOG.filter((item) => !item.recommended)

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
          <div className={`custom-model-block ${selectedModelId === 'custom' ? 'is-selected' : ''}`}>
            <div>
              <strong>Custom model file</strong>
              <p>Load a local `.bin` or `.gguf` file for the current transcription engine.</p>
            </div>
            <div className="custom-model-actions">
              {model && selectedModelId === 'custom' ? <span className="active-indicator">Active</span> : null}
              {model && selectedModelId !== 'custom' ? (
                <Button
                  onClick={() => {
                    onChangeSelectedModelId('custom')
                    onChangeActiveSection('transcribe')
                  }}
                  type="button"
                  variant="secondary"
                  size="sm"
                >
                  Use custom
                </Button>
              ) : null}
              <Button onClick={onChooseModel} type="button" variant="secondary" size="sm">
                <IconFolderOpen />
                {model ? 'Change file' : 'Select file'}
              </Button>
            </div>
          </div>
          {model ? <code className="path-line">{model}</code> : null}

          <div className="model-sections">
            <div className="model-section-header">
              <h3>Recommended models</h3>
              <p>A short list for most local transcription work.</p>
            </div>

            <div className="model-grid">
              {recommendedModels.map((item) => {
                const isSelected = selectedModelId === item.id
                const installedPath = installedModels[item.id]
                const isInstalled = Boolean(installedPath)
                const downloadProgress = downloadingModels[item.id]
                const isDownloading = downloadProgress !== undefined
                const isUninstalling = uninstallingId === item.id

                return (
                  <article className={isSelected ? 'model-card is-selected' : 'model-card'} key={item.id}>
                    <div className="model-card-info">
                      <div className="model-card-title-row">
                        <strong className="model-card-name">{item.name}</strong>
                        <span className="model-card-size">{item.sizeMb} MB</span>
                      </div>
                      <p className="model-card-desc">{item.description}</p>
                      <div className="model-meta-chips">
                        <span className="meta-chip">{item.speed}</span>
                        <span className="meta-chip">{item.quality}</span>
                        <span className="meta-chip">{item.multilingual ? 'Multilingual' : 'English'}</span>
                      </div>
                    </div>
                    <div className="model-card-actions-row">
                      {isDownloading ? (
                        <div className="download-progress-container">
                          <span className="download-progress-label">Downloading {downloadProgress}%</span>
                          <span className="download-meter" role="progressbar" aria-label="Downloading model">
                            <span className="download-progress-value" style={{ width: `${downloadProgress}%` }} />
                          </span>
                        </div>
                      ) : isInstalled ? (
                        <div className="actions-group">
                          {isSelected ? (
                            <span className="active-indicator">Active</span>
                          ) : (
                            <Button
                              onClick={() => {
                                onChangeSelectedModelId(item.id)
                                onChangeActiveSection('transcribe')
                              }}
                              size="sm"
                              type="button"
                              variant="secondary"
                              className="btn-use-model"
                            >
                              Use model
                            </Button>
                          )}
                          <Button
                            disabled={isUninstalling}
                            onClick={() => onUninstallModel(item.id)}
                            size="sm"
                            type="button"
                            variant="ghost"
                            className="btn-remove-model"
                          >
                            <IconTrash2 />
                            <span>{isUninstalling ? 'Removing' : 'Remove'}</span>
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => onDownloadModel(item.id)}
                          size="sm"
                          type="button"
                          variant="secondary"
                          className="btn-install-model"
                        >
                          <IconDownload />
                          Install
                        </Button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="other-models-trigger">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAllModels(!showAllModels)}
                className="toggle-all-btn"
              >
                {showAllModels ? 'Hide other models' : `Show other models (${otherModels.length} more)`}
              </Button>
            </div>

            {showAllModels ? (
              <div className="other-models-list">
                {otherModels.map((item) => {
                  const isSelected = selectedModelId === item.id
                  const installedPath = installedModels[item.id]
                  const isInstalled = Boolean(installedPath)
                  const downloadProgress = downloadingModels[item.id]
                  const isDownloading = downloadProgress !== undefined
                  const isUninstalling = uninstallingId === item.id

                  return (
                    <div className={isSelected ? 'other-model-row is-selected' : 'other-model-row'} key={item.id}>
                      <div className="other-model-info">
                        <strong className="other-model-name">{item.name}</strong>
                        <span className="other-model-size">{item.sizeMb} MB</span>
                        <div className="other-model-meta-chips">
                          <span className="meta-chip">{item.speed}</span>
                          <span className="meta-chip">{item.quality}</span>
                          <span className="meta-chip">{item.multilingual ? 'Multilingual' : 'English'}</span>
                        </div>
                      </div>
                      <div className="other-model-actions">
                        {isDownloading ? (
                          <div className="other-model-download">
                            <span className="download-percent">{downloadProgress}%</span>
                            <span className="download-meter" role="progressbar" aria-label="Downloading model">
                              <span className="download-progress-value" style={{ width: `${downloadProgress}%` }} />
                            </span>
                          </div>
                        ) : isInstalled ? (
                          <div className="other-model-buttons">
                            {isSelected ? (
                              <span className="active-indicator-row">Active</span>
                            ) : (
                              <Button
                                onClick={() => {
                                  onChangeSelectedModelId(item.id)
                                  onChangeActiveSection('transcribe')
                                }}
                                size="sm"
                                type="button"
                                variant="secondary"
                              >
                                Use
                              </Button>
                            )}
                            <Button
                              disabled={isUninstalling}
                              onClick={() => onUninstallModel(item.id)}
                              size="sm"
                              type="button"
                              variant="ghost"
                              title="Remove"
                            >
                              <IconTrash2 />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => onDownloadModel(item.id)}
                            size="sm"
                            type="button"
                            variant="ghost"
                            className="install-btn"
                          >
                            <IconDownload />
                            <span>Install</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
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
          <CardTitle>Access</CardTitle>
          <CardDescription>What Otobun needs to record and save files locally.</CardDescription>
        </CardHeader>
        <CardContent className="settings-stack">
          <div className="permission-row">
            <IconMic />
            <div>
              <strong>Microphone</strong>
              <p>Used only when you press Record. Audio stays on this Mac.</p>
            </div>
            <span className="state-chip is-ready">Prompt on first use</span>
          </div>
          <div className="permission-row">
            <IconFolderOpen />
            <div>
              <strong>Files and folders</strong>
              <p>Used for imported media, downloaded models, recordings, and transcript exports.</p>
            </div>
            <span className="state-chip is-ready">Local files</span>
          </div>
          <div className="notice-box">
            <IconShieldCheck />
            <span>If recording does not start, check System Settings → Privacy & Security → Microphone.</span>
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
              <p>
                {engineStatus?.available ? 'Local transcription engine is ready.' : 'Choose or install whisper-cli.'}
              </p>
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

          <div className="temp-cleanup-card">
            <div>
              <strong>Temporary transcription files</strong>
              <p>Remove stale Otobun temp folders left by cancelled or interrupted jobs.</p>
            </div>
            <Button className="temp-cleanup-button" onClick={onClearTempFiles} size="sm" type="button" variant="danger">
              <IconTrash2 />
              Clear temp files
            </Button>
          </div>
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
                <div className="selected-source-copy">
                  <strong>{mediaFileName}</strong>
                  <code>{input}</code>
                </div>
                <Button onClick={onRemoveInput} size="sm" type="button" variant="ghost">
                  <IconTrash2 />
                  Remove
                </Button>
                <div className="selected-source-player">
                  <AudioWaveformPlayer path={input} title="Preview" />
                </div>
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
            <div
              className={
                recordingState === 'recording'
                  ? 'record-setup is-recording'
                  : recordingState === 'review'
                    ? 'record-setup is-reviewing'
                    : 'record-setup'
              }
            >
              <div className="record-header-row">
                <button
                  className="record-button"
                  disabled={recordingState === 'saving' || status === 'running'}
                  type="button"
                  onClick={recordingState === 'recording' ? onStopRecording : onStartRecording}
                >
                  {recordingState === 'recording' ? <IconPause /> : <IconMic />}
                </button>
                <div className="record-copy">
                  <strong>
                    {recordingState === 'recording'
                      ? 'Recording now'
                      : recordingState === 'saving'
                        ? 'Preparing recorder'
                        : recordingState === 'review'
                          ? 'Review recording'
                          : 'Record local audio'}
                  </strong>
                  <p>
                    {recordingState === 'recording'
                      ? 'Speak naturally. Watch the level meter to confirm the microphone is picking you up.'
                      : recordingState === 'review'
                        ? 'Listen first, then use this recording or record again. Drafts are removable.'
                        : 'Recordings save under Downloads/Otobun/Recordings. Quiet captures are level-adjusted after stop.'}
                  </p>
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
              <div className="record-body-row">
                {recordingState === 'recording' ? (
                  <div className="recording-live-card">
                    <div className="recording-live-side">
                      <span className="recording-live-dot" />
                      <div>
                        <strong>Recording</strong>
                        <span>{formatClock(recordingElapsedMs)}</span>
                      </div>
                    </div>
                    <div className="recording-level-meter" title="Live microphone level">
                      {Array.from({ length: 42 }).map((_, index) => {
                        const wave = 0.45 + Math.sin(index * 0.52) * 0.22 + Math.sin(index * 1.7) * 0.12
                        const height = 7 + Math.round(recordingLevel.rms * 58 * wave + recordingLevel.peak * 20)
                        return (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: decorative level bars are fixed count/order
                            key={index}
                            style={{ height: `${Math.max(5, Math.min(72, height))}px` }}
                          />
                        )
                      })}
                    </div>
                  </div>
                ) : null}
                {recordingState === 'review' && recordingPath ? (
                  <div className="recording-review-card">
                    <AudioWaveformPlayer path={recordingPath} title="Listen before using" />
                    <div className="recording-review-actions">
                      <Button onClick={onUseRecording} size="sm" type="button">
                        <IconFileAudio />
                        Use this recording
                      </Button>
                      <Button onClick={onRecordAgain} size="sm" type="button" variant="secondary">
                        <IconMic />
                        Record again
                      </Button>
                      <Button onClick={onDeleteRecording} size="sm" type="button" variant="ghost">
                        <IconTrash2 />
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : null}
                {recordingPath ? <code className="path-line record-path-line">{recordingPath}</code> : null}
              </div>
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

export { TranscriptForm }
