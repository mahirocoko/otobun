import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'
import type { IMediaPreview } from '../types'

const useMediaPreview = (input: string, ffmpegBin: string) => {
  const [mediaPreview, setMediaPreview] = useState<IMediaPreview | null>(null)
  const [mediaPreviewLoading, setMediaPreviewLoading] = useState(false)
  const [mediaPreviewError, setMediaPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (!input.trim()) {
      setMediaPreview(null)
      setMediaPreviewError(null)
      setMediaPreviewLoading(false)
      return
    }

    let isActive = true
    const loadMediaPreview = async () => {
      setMediaPreviewLoading(true)
      setMediaPreviewError(null)
      try {
        const preview = await invoke<IMediaPreview>('get_media_preview', {
          request: { path: input, ffmpegBin: ffmpegBin.trim() || null, barCount: 64 },
        })
        if (isActive) setMediaPreview(preview)
      } catch (error) {
        if (isActive) {
          setMediaPreview(null)
          setMediaPreviewError(String(error))
        }
      } finally {
        if (isActive) setMediaPreviewLoading(false)
      }
    }

    void loadMediaPreview()
    return () => {
      isActive = false
    }
  }, [ffmpegBin, input])

  const clearMediaPreview = () => {
    setMediaPreview(null)
    setMediaPreviewError(null)
  }

  return { clearMediaPreview, mediaPreview, mediaPreviewError, mediaPreviewLoading }
}

export { useMediaPreview }
