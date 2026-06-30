import IconTrash2 from '~icons/lucide/trash-2'
import { OUTPUT_LOCATION_OPTIONS } from '../../constants'
import type { IEngineStatus, IRecordingDeviceOption, OutputLocation } from '../../types'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { getPathTail } from './helpers'

interface ISettingsPanelProps {
  engineStatus: IEngineStatus | null
  ffmpegBin: string
  keepTemp: boolean
  outputLocation: OutputLocation
  recordingDeviceId: string
  recordingDeviceOptions: IRecordingDeviceOption[]
  whisperBin: string
  onChangeFfmpegBin: (value: string) => void
  onChangeKeepTemp: (value: boolean) => void
  onChangeOutputLocation: (value: OutputLocation) => void
  onChangeRecordingDevice: (value: string) => void
  onChangeWhisperBin: (value: string) => void
  onClearTempFiles: () => void
}

const SettingsPanel = ({
  engineStatus,
  ffmpegBin,
  keepTemp,
  outputLocation,
  recordingDeviceId,
  recordingDeviceOptions,
  whisperBin,
  onChangeFfmpegBin,
  onChangeKeepTemp,
  onChangeOutputLocation,
  onChangeRecordingDevice,
  onChangeWhisperBin,
  onClearTempFiles,
}: ISettingsPanelProps) => (
  <Card className="panel-card narrow-panel">
    <CardHeader>
      <CardTitle>Settings</CardTitle>
      <CardDescription>Local engine and transcript defaults.</CardDescription>
    </CardHeader>
    <CardContent className="settings-stack">
      <div className="engine-status-card">
        <div>
          <strong>{engineStatus?.available ? 'Engine Ready' : 'Engine Missing'}</strong>
          <p>
            {engineStatus?.available
              ? 'whisper.cpp is available for local transcripts.'
              : 'Choose a whisper-cli binary.'}
          </p>
          {engineStatus?.binaryPath ? (
            <code title={engineStatus.binaryPath}>{getPathTail(engineStatus.binaryPath, 3)}</code>
          ) : null}
        </div>
        <span className={engineStatus?.available ? 'state-chip is-ready' : 'state-chip'}>whisper.cpp local</span>
      </div>

      <section className="settings-section">
        <div className="settings-section-header">
          <strong>Transcript defaults</strong>
          <span>Used when starting a new transcript.</span>
        </div>
        <div className="settings-grid">
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
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-header">
          <strong>Engine commands</strong>
          <span>Override only when auto-detect is wrong.</span>
        </div>
        <div className="settings-grid">
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
        </div>
      </section>

      <label className="checkbox-row">
        <input checked={keepTemp} onChange={(event) => onChangeKeepTemp(event.target.checked)} type="checkbox" />
        <span>Keep intermediate audio files for debugging</span>
      </label>

      <div className="temp-cleanup-card">
        <div>
          <strong>Temporary transcription files</strong>
          <p>Remove stale temp folders left by cancelled jobs.</p>
        </div>
        <Button className="temp-cleanup-button" onClick={onClearTempFiles} size="sm" type="button" variant="danger">
          <IconTrash2 />
          Clear temp files
        </Button>
      </div>
    </CardContent>
  </Card>
)

export { SettingsPanel }
