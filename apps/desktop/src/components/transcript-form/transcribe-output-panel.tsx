import { FORMAT_OPTIONS } from '../../constants'
import type { ExportFormat, OutputLocation } from '../../types'
import { Button } from '../ui/button'
import { getPathTail } from './helpers'
import { TranscribePanelHeader } from './panel-header'

interface ITranscribeOutputPanelProps {
  format: ExportFormat
  outputLocation: OutputLocation
  outputPath: string
  onChangeFormat: (value: ExportFormat) => void
  onChooseOutput: () => void
}

const TranscribeOutputPanel = ({
  format,
  outputLocation,
  outputPath,
  onChangeFormat,
  onChooseOutput,
}: ITranscribeOutputPanelProps) => {
  return (
    <section className="transcribe-panel transcribe-output-panel">
      <TranscribePanelHeader title="Output" description="Choose output format and location." />
      <div className="output-summary-card">
        <div>
          <span>Destination</span>
          <strong>
            {outputLocation === 'downloads'
              ? 'Downloads / Otobun'
              : outputLocation === 'source-folder'
                ? 'Source folder'
                : 'Custom path'}
          </strong>
          {outputPath && (
            <code className="path-line" title={outputPath}>
              {getPathTail(outputPath, 2)}
            </code>
          )}
        </div>
        <Button onClick={onChooseOutput} size="sm" type="button" variant="secondary">
          Choose path
        </Button>
      </div>

      <div className="format-select-group">
        <span className="format-label">Export format</span>
        <div className="format-row">
          {FORMAT_OPTIONS.map((item) => (
            <Button
              className={format === item.value ? 'format-button is-selected' : 'format-button'}
              key={item.value}
              onClick={() => onChangeFormat(item.value)}
              size="sm"
              type="button"
              variant="secondary"
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}

export { TranscribeOutputPanel }
