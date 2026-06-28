import IconLoader from '~icons/lucide/loader-circle'
import type { ITranscribeProgress } from '../../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

interface ITranscribeProgressScreenProps {
  progress: ITranscribeProgress | null
}

const TranscribeProgressScreen = ({ progress }: ITranscribeProgressScreenProps) => {
  const percent = Math.max(4, Math.min(100, progress?.percent ?? 4))

  return (
    <Card className="panel-card progress-screen-card">
      <CardHeader>
        <CardTitle>Transcribing locally</CardTitle>
        <CardDescription>Otobun is keeping the media and model work on this Mac.</CardDescription>
      </CardHeader>
      <CardContent className="progress-screen-content">
        <div className="progress-orb" aria-hidden="true">
          <IconLoader />
        </div>
        <div className="progress-screen-copy">
          <strong>{progress?.message ?? 'Preparing transcription'}</strong>
          <p>{progress?.stage ? `Stage: ${progress.stage}` : 'Normalizing audio and running whisper.cpp.'}</p>
        </div>
        <div className="progress-screen-meter">
          <span>{Math.round(progress?.percent ?? 0)}%</span>
          <span className="progress-track" role="progressbar" aria-label="Transcription progress">
            <span style={{ width: `${percent}%` }} />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export { TranscribeProgressScreen }
