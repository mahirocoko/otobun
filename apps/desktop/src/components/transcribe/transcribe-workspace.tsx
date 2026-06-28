import type { ComponentProps } from 'react'
import type { ITranscribeProgress } from '../../types'
import { PreviewCard } from '../preview-card'
import { TranscriptForm } from '../transcript-form'
import { TranscribeProgressScreen } from './transcribe-progress-screen'

type ITranscriptFormProps = ComponentProps<typeof TranscriptForm>

type ITranscribeWorkspaceProps = ITranscriptFormProps & {
  output: string
  transcribeProgress: ITranscribeProgress | null
  onCopyOutput: () => void
  onNewTranscript: () => void
}

const TranscribeWorkspace = ({ output, onCopyOutput, onNewTranscript, ...formProps }: ITranscribeWorkspaceProps) => {
  if (formProps.status === 'running') {
    return <TranscribeProgressScreen progress={formProps.transcribeProgress} />
  }

  if (output) {
    return (
      <PreviewCard format={formProps.format} output={output} onCopy={onCopyOutput} onNewTranscript={onNewTranscript} />
    )
  }

  return <TranscriptForm {...formProps} />
}

export { TranscribeWorkspace }
