import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useState } from 'react'
import { MODEL_CATALOG } from '../constants'
import type { IModelDownloadProgress, IModelFileResponse } from '../types'

interface IUseInstalledModelsOptions {
  selectedModelId: string
  customModelPath: string
  onFallbackToCustom: () => void
  onMessage: (message: string) => void
  onError: (message: string) => void
  onSelectModel: (id: string) => void
}

const useInstalledModels = ({
  customModelPath,
  onError,
  onFallbackToCustom,
  onMessage,
  onSelectModel,
  selectedModelId,
}: IUseInstalledModelsOptions) => {
  const [installedModels, setInstalledModels] = useState<Record<string, string>>({})
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [uninstallingId, setUninstallingId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  useEffect(() => {
    const syncInstalledModels = async () => {
      try {
        const responses = await invoke<IModelFileResponse[]>('list_models', {
          requests: MODEL_CATALOG.map((item) => ({ id: item.id, fileName: item.fileName })),
        })
        setInstalledModels(Object.fromEntries(responses.map((item) => [item.id, item.path])))
      } catch (error) {
        onMessage(`Model check failed: ${String(error)}`)
      }
    }

    void syncInstalledModels()
  }, [onMessage])

  useEffect(() => {
    if (selectedModelId === 'custom') return
    if (Object.keys(installedModels).length === 0) return
    if (!installedModels[selectedModelId]) onFallbackToCustom()
  }, [installedModels, onFallbackToCustom, selectedModelId])

  useEffect(() => {
    const unlisten = listen<IModelDownloadProgress>('model-download-progress', (event) => {
      const progress = event.payload.percent ?? (event.payload.state === 'starting' ? 2 : 10)
      setDownloadProgress(Math.max(0, Math.min(100, Math.round(progress / 10) * 10)))
    })

    return () => {
      void unlisten.then((dispose) => dispose())
    }
  }, [])

  const downloadModel = async (id: string) => {
    const catalogItem = MODEL_CATALOG.find((item) => item.id === id)
    if (!catalogItem) return

    setDownloadingId(id)
    setDownloadProgress(0)
    onMessage(`Downloading ${catalogItem.name}`)

    try {
      const response = await invoke<IModelFileResponse>('download_model', {
        request: { id: catalogItem.id, fileName: catalogItem.fileName },
      })
      setInstalledModels((current) => ({ ...current, [response.id]: response.path }))
      onSelectModel(response.id)
      setDownloadProgress(100)
      onMessage(`${catalogItem.name} installed`)
    } catch (error) {
      onError(String(error))
    } finally {
      setDownloadingId(null)
      setDownloadProgress(0)
    }
  }

  const uninstallModel = async (id: string) => {
    const catalogItem = MODEL_CATALOG.find((item) => item.id === id)
    if (!catalogItem) return

    setUninstallingId(id)
    onMessage(`Removing ${catalogItem.name}`)

    try {
      await invoke('uninstall_model', {
        request: { id: catalogItem.id, fileName: catalogItem.fileName },
      })
      setInstalledModels((current) => {
        const nextModels = { ...current }
        delete nextModels[id]
        return nextModels
      })
      if (selectedModelId === id) onFallbackToCustom()
      onMessage(`${catalogItem.name} removed`)
    } catch (error) {
      onError(String(error))
    } finally {
      setUninstallingId(null)
    }
  }

  return {
    downloadModel,
    downloadingId,
    downloadProgress,
    installedModels,
    selectedModelPath: selectedModelId === 'custom' ? customModelPath.trim() : installedModels[selectedModelId],
    uninstallingId,
    uninstallModel,
  }
}

export { useInstalledModels }
