import { useState } from 'react'
import IconDownload from '~icons/lucide/download'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconInfo from '~icons/lucide/info'
import IconTrash2 from '~icons/lucide/trash-2'
import { MODEL_CATALOG } from '../../constants'
import type { AppSection } from '../../types'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { getPathTail } from './helpers'

interface IModelManagerPanelProps {
  downloadingModels: Record<string, number>
  installedModels: Record<string, string>
  model: string
  selectedModelId: string
  uninstallingId: string | null
  onChangeActiveSection: (value: AppSection) => void
  onChangeSelectedModelId: (value: string) => void
  onChooseModel: () => void
  onDownloadModel: (id: string) => void
  onUninstallModel: (id: string) => void
}

const ModelManagerPanel = ({
  downloadingModels,
  installedModels,
  model,
  selectedModelId,
  uninstallingId,
  onChangeActiveSection,
  onChangeSelectedModelId,
  onChooseModel,
  onDownloadModel,
  onUninstallModel,
}: IModelManagerPanelProps) => {
  const [showAllModels, setShowAllModels] = useState(false)
  const recommendedModels = MODEL_CATALOG.filter((item) => item.recommended)
  const otherModels = MODEL_CATALOG.filter((item) => !item.recommended)

  return (
    <Card className="panel-card">
      <CardHeader>
        <CardTitle>Model manager</CardTitle>
        <CardDescription>Install or choose a local Whisper model.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`custom-model-block ${model && selectedModelId === 'custom' ? 'is-selected' : ''}`}>
          <div>
            <strong>Custom model file</strong>
            <p>Use your own `.bin` or `.gguf` model.</p>
            {model ? (
              <code className="path-line custom-model-path" title={model}>
                {getPathTail(model, 2)}
              </code>
            ) : null}
          </div>
          <div className="custom-model-actions">
            {model && selectedModelId === 'custom' ? <span className="active-indicator">Active</span> : null}
            {model && selectedModelId !== 'custom' ? (
              <Button
                onClick={() => {
                  onChangeSelectedModelId('custom')
                  onChangeActiveSection('transcribe')
                }}
                type="button"
                variant="secondary"
                size="sm"
              >
                Use custom
              </Button>
            ) : null}
            <Button onClick={onChooseModel} type="button" variant="secondary" size="sm">
              <IconFolderOpen />
              {model ? 'Change file' : 'Select file'}
            </Button>
          </div>
        </div>

        <div className="model-sections">
          <div className="model-section-header">
            <h3>Recommended models</h3>
            <p>Best starting points for local transcripts.</p>
          </div>

          <div className="model-grid">
            {recommendedModels.map((item) => {
              const isSelected = selectedModelId === item.id
              const installedPath = installedModels[item.id]
              const isInstalled = Boolean(installedPath)
              const downloadProgress = downloadingModels[item.id]
              const isDownloading = downloadProgress !== undefined
              const isUninstalling = uninstallingId === item.id

              return (
                <article className={isSelected ? 'model-card is-selected' : 'model-card'} key={item.id}>
                  <div className="model-card-info">
                    <div className="model-card-title-row">
                      <strong className="model-card-name">{item.name}</strong>
                      <span className="model-card-size">{item.sizeMb} MB</span>
                    </div>
                    <p className="model-card-desc">{item.description}</p>
                    <div className="model-meta-chips">
                      <span className="meta-chip">{item.speed}</span>
                      <span className="meta-chip">{item.quality}</span>
                      <span className="meta-chip">{item.multilingual ? 'Multilingual' : 'English'}</span>
                    </div>
                  </div>
                  <div className="model-card-actions-row">
                    {isDownloading ? (
                      <div className="download-progress-container">
                        <span className="download-progress-label">Downloading {downloadProgress}%</span>
                        <span className="download-meter" role="progressbar" aria-label="Downloading model">
                          <span className="download-progress-value" style={{ width: `${downloadProgress}%` }} />
                        </span>
                      </div>
                    ) : isInstalled ? (
                      <div className="actions-group">
                        {isSelected ? (
                          <span className="active-indicator">Active</span>
                        ) : (
                          <Button
                            onClick={() => {
                              onChangeSelectedModelId(item.id)
                              onChangeActiveSection('transcribe')
                            }}
                            size="sm"
                            type="button"
                            variant="secondary"
                            className="btn-use-model"
                          >
                            Use model
                          </Button>
                        )}
                        <Button
                          disabled={isUninstalling}
                          onClick={() => onUninstallModel(item.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                          className="btn-remove-model"
                        >
                          <IconTrash2 />
                          <span>{isUninstalling ? 'Removing' : 'Remove'}</span>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => onDownloadModel(item.id)}
                        size="sm"
                        type="button"
                        variant="secondary"
                        className="btn-install-model"
                      >
                        <IconDownload />
                        Install
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="other-models-trigger">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAllModels(!showAllModels)}
              className="toggle-all-btn"
            >
              {showAllModels ? 'Hide other models' : `Show all models (${otherModels.length})`}
            </Button>
          </div>

          {showAllModels ? (
            <div className="other-models-list">
              {otherModels.map((item) => {
                const isSelected = selectedModelId === item.id
                const installedPath = installedModels[item.id]
                const isInstalled = Boolean(installedPath)
                const downloadProgress = downloadingModels[item.id]
                const isDownloading = downloadProgress !== undefined
                const isUninstalling = uninstallingId === item.id

                return (
                  <div className={isSelected ? 'other-model-row is-selected' : 'other-model-row'} key={item.id}>
                    <div className="other-model-info">
                      <strong className="other-model-name">{item.name}</strong>
                      <span className="other-model-size">{item.sizeMb} MB</span>
                      <div className="other-model-meta-chips">
                        <span className="meta-chip">{item.speed}</span>
                        <span className="meta-chip">{item.quality}</span>
                        <span className="meta-chip">{item.multilingual ? 'Multilingual' : 'English'}</span>
                      </div>
                    </div>
                    <div className="other-model-actions">
                      {isDownloading ? (
                        <div className="other-model-download">
                          <span className="download-percent">{downloadProgress}%</span>
                          <span className="download-meter" role="progressbar" aria-label="Downloading model">
                            <span className="download-progress-value" style={{ width: `${downloadProgress}%` }} />
                          </span>
                        </div>
                      ) : isInstalled ? (
                        <div className="other-model-buttons">
                          {isSelected ? (
                            <span className="active-indicator-row">Active</span>
                          ) : (
                            <Button
                              onClick={() => {
                                onChangeSelectedModelId(item.id)
                                onChangeActiveSection('transcribe')
                              }}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              Use
                            </Button>
                          )}
                          <Button
                            disabled={isUninstalling}
                            onClick={() => onUninstallModel(item.id)}
                            size="sm"
                            type="button"
                            variant="ghost"
                            title="Remove"
                          >
                            <IconTrash2 />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => onDownloadModel(item.id)}
                          size="sm"
                          type="button"
                          variant="ghost"
                          className="install-btn"
                        >
                          <IconDownload />
                          <span>Install</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>

        {selectedModelId !== 'custom' && !installedModels[selectedModelId] ? (
          <div className="notice-box">
            <IconInfo />
            <span>Install the selected model, or choose a custom local file.</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { ModelManagerPanel }
