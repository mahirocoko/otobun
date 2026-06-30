import type { JobState } from '../../types'
import { Button } from '../ui/button'

interface ITranscribeActionFooterProps {
  canTranscribe: boolean
  status: JobState
  onExportSample: () => void
  onTranscribe: () => void
}

const TranscribeActionFooter = ({
  canTranscribe,
  status,
  onExportSample,
  onTranscribe,
}: ITranscribeActionFooterProps) => (
  <div className="transcribe-action-footer action-row">
    <Button disabled={status === 'running'} onClick={onExportSample} type="button" variant="secondary">
      Load sample
    </Button>
    <Button disabled={status === 'running' || !canTranscribe} onClick={onTranscribe} type="button">
      {status === 'running' ? 'Working…' : 'Transcribe'}
    </Button>
  </div>
)

export { TranscribeActionFooter }
