import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'
import type { IEngineStatus } from '../types'

const useEngineStatus = (whisperBin: string, setWhisperBin: (value: string) => void) => {
  const [engineStatus, setEngineStatus] = useState<IEngineStatus | null>(null)

  useEffect(() => {
    const syncEngineStatus = async () => {
      try {
        const status = await invoke<IEngineStatus>('get_engine_status')
        setEngineStatus(status)
        if (status.binaryPath && !whisperBin.trim()) setWhisperBin(status.binaryPath)
      } catch (error) {
        setEngineStatus({ available: false, binaryPath: null, version: null, message: String(error) })
      }
    }

    void syncEngineStatus()
  }, [setWhisperBin, whisperBin])

  return engineStatus
}

export { useEngineStatus }
