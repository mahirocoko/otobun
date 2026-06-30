import { DECODE_PROFILE_OPTIONS } from '../../constants'
import type { DecodeProfile, TranscribeMode } from '../../types'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { TranscribePanelHeader } from './panel-header'

interface ITranscribeOptionsPanelProps {
  decodeProfile: DecodeProfile
  language: string
  title: string
  transcribeMode: TranscribeMode
  onChangeDecodeProfile: (value: DecodeProfile) => void
  onChangeLanguage: (value: string) => void
  onChangeTitle: (value: string) => void
  onChangeTranscribeMode: (value: TranscribeMode) => void
}

const TranscribeOptionsPanel = ({
  decodeProfile,
  language,
  title,
  transcribeMode,
  onChangeDecodeProfile,
  onChangeLanguage,
  onChangeTitle,
  onChangeTranscribeMode,
}: ITranscribeOptionsPanelProps) => (
  <section className="transcribe-panel transcribe-options-panel">
    <TranscribePanelHeader title="Transcript setup" description="Configure settings for the transcription." />
    <div className="form-grid transcribe-panel-grid">
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

      <div className="field-row form-grid-wide">
        <span>Decode profile</span>
        <Select value={decodeProfile} onValueChange={(value) => onChangeDecodeProfile(value as DecodeProfile)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DECODE_PROFILE_OPTIONS.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="field-hint">{DECODE_PROFILE_OPTIONS.find((item) => item.id === decodeProfile)?.description}</p>
      </div>
    </div>
  </section>
)

export { TranscribeOptionsPanel }
