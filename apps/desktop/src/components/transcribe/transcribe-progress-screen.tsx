import { useState } from 'react'
import IconLoader from '~icons/lucide/loader-circle'
import IconX from '~icons/lucide/x'
import type { ITranscribeActivityItem, ITranscribeProgress, ITranscribeProgressContext } from '../../types'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

interface ITranscribeProgressScreenProps {
  context: ITranscribeProgressContext
  activityLog: ITranscribeActivityItem[]
  isCancelling: boolean
  progress: ITranscribeProgress | null
  onCancel: () => void
}

const formatDuration = (durationMs?: number | null) => {
  if (!durationMs) return '--:--'
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const STAGE_LABELS: Record<string, string> = {
  cancelling: 'Cancelling',
  chunking: 'Preparing chunks',
  done: 'Complete',
  exporting: 'Writing output',
  normalizing: 'Normalizing audio',
  parsing: 'Merging transcript',
  preparing: 'Preparing workspace',
  queued: 'Queued',
  sample: 'Loading sample',
  transcribing: 'Running Whisper',
}

const TranscribeProgressScreen = ({
  context,
  activityLog,
  isCancelling,
  progress,
  onCancel,
}: ITranscribeProgressScreenProps) => {
  const [showActivity, setShowActivity] = useState(false)
  const percent = Math.max(4, Math.min(100, progress?.percent ?? 4))
  const displayPercent = Math.round(progress?.percent ?? 0)
  const stageLabel = progress?.stage ? (STAGE_LABELS[progress.stage] ?? progress.stage) : 'Preparing'
  const chunkTotal = progress?.chunkTotal ?? 0
  const chunkIndex = progress?.chunkIndex ?? 0

  return (
    <Card className="panel-card progress-screen-card">
      <CardHeader>
        <div className="progress-screen-head">
          <div>
            <CardTitle>{isCancelling ? 'Cancelling transcription' : 'Transcribing locally'}</CardTitle>
            <CardDescription>Otobun is processing the selected file with your current settings.</CardDescription>
          </div>
          <Button disabled={isCancelling} onClick={onCancel} size="sm" type="button" variant="danger">
            <IconX />
            {isCancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="progress-screen-content">
        <div className="progress-orb" aria-hidden="true">
          <IconLoader />
        </div>
        <div className="progress-screen-copy">
          <strong>{progress?.message ?? 'Preparing transcription'}</strong>
          <p>{stageLabel}</p>
        </div>
        <div className="progress-context-grid">
          <span>
            <span>File:</span> <strong>{context.fileName || 'Selected media'}</strong>
          </span>
          <span>
            <span>Model:</span> <strong>{context.modelName}</strong>
          </span>
          <span>
            <span>Mode:</span> <strong>{context.modeLabel}</strong>
          </span>
          <span>
            <span>Language:</span> <strong>{context.languageLabel}</strong>
          </span>
          <span>
            <span>Format:</span> <strong>{context.formatLabel}</strong>
          </span>
          <span>
            <span>Output:</span> <strong>{context.outputLabel}</strong>
          </span>
        </div>
        <div className="progress-screen-meter">
          <div className="progress-meter-head">
            <span>Overall progress</span>
            <strong>{displayPercent}%</strong>
          </div>
          <span className="progress-track" role="progressbar" aria-label="Transcription progress">
            <span style={{ width: `${percent}%` }} />
          </span>
        </div>
        {chunkTotal > 0 ? (
          <div className="chunk-progress-panel">
            <div>
              <strong>
                Chunks · {chunkIndex} of {chunkTotal}
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
        {activityLog.length > 0 ? (
          <div className="activity-log-panel">
            <button className="activity-log-toggle" type="button" onClick={() => setShowActivity((value) => !value)}>
              <span>Activity details</span>
              <strong>{showActivity ? 'Hide' : `${activityLog.length} updates`}</strong>
            </button>
            {showActivity ? (
              <ol className="activity-log-list">
                {activityLog.map((item) => (
                  <li key={item.id}>
                    <time>{item.time}</time>
                    <span>
                      <strong>{item.label}</strong>
                      {item.detail ? <small>{item.detail}</small> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { TranscribeProgressScreen }
