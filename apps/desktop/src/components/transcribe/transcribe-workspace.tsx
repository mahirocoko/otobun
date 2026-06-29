import type { ComponentProps } from 'react'
import type { ITranscribeProgress, ITranscribeProgressContext, ITranscribeResultMeta } from '../../types'
import { PreviewCard } from '../preview-card'
import { TranscriptForm } from '../transcript-form'
import { TranscribeProgressScreen } from './transcribe-progress-screen'

type ITranscriptFormProps = ComponentProps<typeof TranscriptForm>

type ITranscribeWorkspaceProps = ITranscriptFormProps & {
  output: string
  progressContext: ITranscribeProgressContext
  resultMeta: ITranscribeResultMeta
  transcribeProgress: ITranscribeProgress | null
  onCopyOutput: () => void
  onNewTranscript: () => void
}

const TranscribeWorkspace = ({
  output,
  progressContext,
  resultMeta,
  onCopyOutput,
  onNewTranscript,
  ...formProps
}: ITranscribeWorkspaceProps) => {
  if (formProps.status === 'running') {
    return <TranscribeProgressScreen context={progressContext} progress={formProps.transcribeProgress} />
  }

  if (output) {
    return (
      <PreviewCard
        format={formProps.format}
        input={formProps.input}
        meta={resultMeta}
        output={output}
        onCopy={onCopyOutput}
        onNewTranscript={onNewTranscript}
      />
    )
  }

  return <TranscriptForm {...formProps} />
}

export { TranscribeWorkspace }
