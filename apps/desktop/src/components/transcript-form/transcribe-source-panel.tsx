import IconFileAudio from '~icons/lucide/file-audio'
import IconFolderDown from '~icons/lucide/folder-down'
import IconMic from '~icons/lucide/mic'
import IconPause from '~icons/lucide/pause'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconTrash2 from '~icons/lucide/trash-2'
import type { InputMode, IRecordingDeviceOption, IRecordingLevelEvent, JobState } from '../../types'
import { AudioWaveformPlayer } from '../audio-waveform-player'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { formatClock } from './helpers'
import { TranscribePanelHeader } from './panel-header'

interface ITranscribeSourcePanelProps {
  inputMode: InputMode
  input: string
  mediaFileName: string
  recordingDeviceId: string
  recordingDeviceOptions: IRecordingDeviceOption[]
  recordingElapsedMs: number
  recordingLevel: IRecordingLevelEvent
  recordingPath: string
  recordingState: 'idle' | 'recording' | 'saving' | 'review'
  status: JobState
  onChangeInputMode: (value: InputMode) => void
  onChangeRecordingDevice: (value: string) => void
  onChooseInput: () => void
  onDeleteRecording: () => void
  onRecordAgain: () => void
  onRemoveInput: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onUseRecording: () => void
}

const TranscribeSourcePanel = ({
  inputMode,
  input,
  mediaFileName,
  recordingDeviceId,
  recordingDeviceOptions,
  recordingElapsedMs,
  recordingLevel,
  recordingPath,
  recordingState,
  status,
  onChangeInputMode,
  onChangeRecordingDevice,
  onChooseInput,
  onDeleteRecording,
  onRecordAgain,
  onRemoveInput,
  onStartRecording,
  onStopRecording,
  onUseRecording,
}: ITranscribeSourcePanelProps) => (
  <section className="transcribe-panel transcribe-source-panel">
    <TranscribePanelHeader title="Source" description="Select a media file or record local audio." />
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
                : recordingState === 'saving'
                  ? 'record-setup is-saving'
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
                  ? 'Recording... Watch level meter for input.'
                  : recordingState === 'review'
                    ? 'Review your draft before transcribing.'
                    : 'Audio drafts are saved to Downloads/Otobun/Recordings.'}
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
            {recordingState === 'saving' ? (
              <div className="recording-saving-card">
                <IconRefreshCw className="spinner-icon" />
                <span>Saving recording draft...</span>
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
  </section>
)

export { TranscribeSourcePanel }
