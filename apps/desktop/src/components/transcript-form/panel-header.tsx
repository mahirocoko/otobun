interface ITranscribePanelHeaderProps {
  title: string
  description: string
}

const TranscribePanelHeader = ({ title, description }: ITranscribePanelHeaderProps) => (
  <div className="transcribe-panel-header">
    <strong>{title}</strong>
    <span>{description}</span>
  </div>
)

export { TranscribePanelHeader }
