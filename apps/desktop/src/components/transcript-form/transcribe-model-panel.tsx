import IconFileText from '~icons/lucide/file-text'
import IconInfo from '~icons/lucide/info'
import type { AppSection, IModelCatalogItem } from '../../types'
import { Button } from '../ui/button'
import { getFileName, getPathTail } from './helpers'
import { TranscribePanelHeader } from './panel-header'

interface ITranscribeModelPanelProps {
  hasLanguageModelMismatch?: boolean
  installedModels: Record<string, string>
  model: string
  selectedCatalogModel?: IModelCatalogItem
  selectedModelId: string
  onChangeActiveSection: (value: AppSection) => void
}

const TranscribeModelPanel = ({
  hasLanguageModelMismatch,
  installedModels,
  model,
  selectedCatalogModel,
  selectedModelId,
  onChangeActiveSection,
}: ITranscribeModelPanelProps) => {
  const modelPath = selectedModelId === 'custom' ? model : installedModels[selectedModelId]
  const isInstalled = selectedModelId === 'custom' ? Boolean(model) : Boolean(installedModels[selectedModelId])

  return (
    <section className="transcribe-panel transcribe-model-panel">
      <TranscribePanelHeader title="Model" description="Local transcription model." />
      <div className="model-summary-card">
        <IconFileText />
        <div>
          <span>Model</span>
          <strong>
            {selectedModelId === 'custom'
              ? model
                ? getFileName(model)
                : 'Custom model required'
              : selectedCatalogModel?.name}
          </strong>
          {isInstalled ? (
            <code className="path-line" title={modelPath}>
              {getPathTail(modelPath, 2)}
            </code>
          ) : (
            <p>
              {selectedModelId === 'custom' ? 'Select a local model file.' : 'Install this model before transcribing.'}
            </p>
          )}
        </div>
        <Button onClick={() => onChangeActiveSection('models')} size="sm" type="button" variant="secondary">
          Change
        </Button>
      </div>
      {hasLanguageModelMismatch ? (
        <div className="config-warning-card">
          <IconInfo />
          <div>
            <strong>Use a multilingual model for Thai audio</strong>
            <p>
              {selectedCatalogModel?.name ?? 'This model'} is English-only, but the current language setting includes
              Thai.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export { TranscribeModelPanel }
