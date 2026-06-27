import IconDownload from '~icons/lucide/download'
import IconFileAudio from '~icons/lucide/file-audio'
import IconFileText from '~icons/lucide/file-text'
import IconFolderDown from '~icons/lucide/folder-down'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconInfo from '~icons/lucide/info'
import IconMic from '~icons/lucide/mic'
import IconShieldCheck from '~icons/lucide/shield-check'
import IconTrash2 from '~icons/lucide/trash-2'
import { FORMAT_OPTIONS, MODEL_CATALOG, OUTPUT_LOCATION_OPTIONS } from '../constants'
import type { AppSection, ExportFormat, InputMode, IRecordingDeviceOption, JobState, OutputLocation } from '../types'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

interface ITranscriptFormProps {
  activeSection: AppSection
  canTranscribe: boolean
  ffmpegBin: string
  format: ExportFormat
  input: string
  inputMode: InputMode
  keepTemp: boolean
  language: string
  model: string
  outputLocation: OutputLocation
  outputPath: string
  recordingDeviceId: string
  recordingDeviceOptions: IRecordingDeviceOption[]
  status: JobState
  title: string
  whisperBin: string
  selectedModelId: string
  installedModels: Record<string, boolean>
  downloadingId: string | null
  downloadProgress: number
  onChangeSelectedModelId: (value: string) => void
  onDownloadModel: (id: string) => void
  onChangeActiveSection: (value: AppSection) => void
  onChangeFfmpegBin: (value: string) => void
  onChangeFormat: (value: ExportFormat) => void
  onChangeInputMode: (value: InputMode) => void
  onChangeOutputLocation: (value: OutputLocation) => void
  onChangeKeepTemp: (value: boolean) => void
  onChangeLanguage: (value: string) => void
  onChangeRecordingDevice: (value: string) => void
  onChangeTitle: (value: string) => void
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
  ffmpegBin,
  format,
  input,
  inputMode,
  installedModels,
  keepTemp,
  language,
  model,
  outputLocation,
  outputPath,
  recordingDeviceId,
  recordingDeviceOptions,
  selectedModelId,
  status,
  title,
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
  onChangeWhisperBin,
  onChooseInput,
  onChooseModel,
  onChooseOutput,
  onDownloadModel,
  onExportSample,
  onRemoveInput,
  onTranscribe,
}: ITranscriptFormProps) => {
  const selectedCatalogModel = MODEL_CATALOG.find((item) => item.id === selectedModelId)
  const mediaFileName = input ? getFileName(input) : ''

  if (activeSection === 'models') {
    return (
      <Card className="panel-card">
        <CardHeader>
          <CardTitle>Model manager</CardTitle>
          <CardDescription>
            Choose a Whisper model profile. Custom model files are the active execution path in this build.
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
              const isInstalled = installedModels[item.id]
              const isDownloading = downloadingId === item.id

              return (
                <button
                  className={isSelected ? 'model-card is-selected' : 'model-card'}
                  key={item.id}
                  onClick={() => onChangeSelectedModelId(item.id)}
                  type="button"
                >
                  <div className="model-card-head">
                    <strong>{item.name}</strong>
                    <span>{item.sizeMb} MB</span>
                  </div>
                  <p>{item.description}</p>
                  <div className="model-card-meta">
                    <span>{item.speed}</span>
                    <span>{item.quality}</span>
                    <span>{item.multilingual ? 'Multilingual' : 'English'}</span>
                  </div>
                  <div className="model-card-footer">
                    {isInstalled ? (
                      <span className="state-chip is-ready">Ready</span>
                    ) : (
                      <span className="state-chip">Not installed</span>
                    )}
                    {isDownloading ? (
                      <span className="download-meter">
                        <span className={`download-progress-value progress-${downloadProgress}`} />
                      </span>
                    ) : (
                      <Button onClick={() => onDownloadModel(item.id)} size="sm" type="button" variant="secondary">
                        <IconDownload />
                        Install
                      </Button>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {selectedModelId !== 'custom' ? (
            <div className="notice-box">
              <IconInfo />
              <span>
                Managed downloads need the downloader engine pass. Select Custom model file to run transcription now.
              </span>
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
            <span>whisper-cli command</span>
            <Input value={whisperBin} onChange={(event) => onChangeWhisperBin(event.target.value)} />
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
              <div className="selected-source">
                <IconFileAudio />
                <div>
                  <strong>{mediaFileName}</strong>
                  <code>{input}</code>
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
                : 'Open Models to select a custom executable model file.'}
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
                ? 'Downloads'
                : outputLocation === 'source-folder'
                  ? 'Source folder'
                  : 'Custom path'}
            </strong>
            <p>{outputPath || 'Files save to Downloads unless you choose a path.'}</p>
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
