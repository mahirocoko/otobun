import type { ComponentProps } from 'react'
import type {
  ITranscribeActivityItem,
  ITranscribeProgress,
  ITranscribeProgressContext,
  ITranscribeResultMeta,
  ITranscript,
} from '../../types'
import { PreviewCard } from '../preview-card'
import { TranscriptForm } from '../transcript-form'
import { TranscribeProgressScreen } from './transcribe-progress-screen'

type ITranscriptFormProps = ComponentProps<typeof TranscriptForm>

type ITranscribeWorkspaceProps = ITranscriptFormProps & {
  output: string
  transcript: ITranscript | null
  activityLog: ITranscribeActivityItem[]
  isCancelling: boolean
  progressContext: ITranscribeProgressContext
  resultMeta: ITranscribeResultMeta
  transcribeProgress: ITranscribeProgress | null
  onCopyOutput: () => void
  onCancelTranscribe: () => void
  onNewTranscript: () => void
}

const TranscribeWorkspace = ({
  output,
  transcript,
  activityLog,
  isCancelling,
  progressContext,
  resultMeta,
  onCancelTranscribe,
  onCopyOutput,
  onNewTranscript,
  ...formProps
}: ITranscribeWorkspaceProps) => {
  if (formProps.status === 'running') {
    return (
      <TranscribeProgressScreen
        context={progressContext}
        activityLog={activityLog}
        isCancelling={isCancelling}
        progress={formProps.transcribeProgress}
        onCancel={onCancelTranscribe}
      />
    )
  }

  if (output) {
    return (
      <PreviewCard
        format={formProps.format}
        input={formProps.input}
        meta={resultMeta}
        output={output}
        transcript={transcript}
        onCopy={onCopyOutput}
        onNewTranscript={onNewTranscript}
      />
    )
  }

  return <TranscriptForm {...formProps} />
}

export { TranscribeWorkspace }
