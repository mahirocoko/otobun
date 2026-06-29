import IconLoader from '~icons/lucide/loader-circle'
import type { ITranscribeProgress, ITranscribeProgressContext } from '../../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

interface ITranscribeProgressScreenProps {
  context: ITranscribeProgressContext
  progress: ITranscribeProgress | null
}

const formatDuration = (durationMs?: number | null) => {
  if (!durationMs) return '--:--'
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const TranscribeProgressScreen = ({ context, progress }: ITranscribeProgressScreenProps) => {
  const percent = Math.max(4, Math.min(100, progress?.percent ?? 4))
  const chunkTotal = progress?.chunkTotal ?? 0
  const chunkIndex = progress?.chunkIndex ?? 0

  return (
    <Card className="panel-card progress-screen-card">
      <CardHeader>
        <CardTitle>Transcribing locally</CardTitle>
        <CardDescription>Otobun is processing the selected file with your current settings.</CardDescription>
      </CardHeader>
      <CardContent className="progress-screen-content">
        <div className="progress-orb" aria-hidden="true">
          <IconLoader />
        </div>
        <div className="progress-screen-copy">
          <strong>{progress?.message ?? 'Preparing transcription'}</strong>
          <p>{progress?.stage ? `Stage: ${progress.stage}` : 'Normalizing audio and running whisper.cpp.'}</p>
        </div>
        <div className="progress-context-grid">
          <span>
            File <strong>{context.fileName || 'Selected media'}</strong>
          </span>
          <span>
            Model <strong>{context.modelName}</strong>
          </span>
          <span>
            Mode <strong>{context.modeLabel}</strong>
          </span>
          <span>
            Language <strong>{context.languageLabel}</strong>
          </span>
          <span>
            Format <strong>{context.formatLabel}</strong>
          </span>
          <span>
            Output <strong>{context.outputLabel}</strong>
          </span>
        </div>
        <div className="progress-screen-meter">
          <span>{Math.round(progress?.percent ?? 0)}%</span>
          <span className="progress-track" role="progressbar" aria-label="Transcription progress">
            <span style={{ width: `${percent}%` }} />
          </span>
        </div>
        {chunkTotal > 0 ? (
          <div className="chunk-progress-panel">
            <div>
              <strong>
                Chunk {chunkIndex}/{chunkTotal}
              </strong>
              <span>
                {formatDuration(progress?.chunkStartMs)} – {formatDuration(progress?.chunkEndMs)}
              </span>
            </div>
            <div className="chunk-rail">
              {Array.from({ length: chunkTotal }).map((_, index) => {
                const item = index + 1
                return (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: chunk count/order is stable for one transcription run
                    key={index}
                    className={item < chunkIndex ? 'is-done' : item === chunkIndex ? 'is-active' : undefined}
                  />
                )
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { TranscribeProgressScreen }
