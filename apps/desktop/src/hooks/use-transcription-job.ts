import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useState } from 'react'
import type {
  ExportFormat,
  ICommandResponse,
  ITranscribeProgress,
  JobState,
  OutputLocation,
  TranscribeMode,
} from '../types'
import { resolveDefaultOutputPath } from '../utils/paths'

interface IRunTranscribeInput {
  ffmpegBin: string
  format: ExportFormat
  input: string
  keepTemp: boolean
  language: string
  modelPath?: string
  outputLocation: OutputLocation
  outputPath: string
  title: string
  transcribeMode: TranscribeMode
  whisperBin: string
}

const useTranscriptionJob = (onMessage: (message: string) => void) => {
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<JobState>('idle')
  const [transcribeProgress, setTranscribeProgress] = useState<ITranscribeProgress | null>(null)

  useEffect(() => {
    const unlisten = listen<ITranscribeProgress>('transcribe-progress', (event) => {
      setTranscribeProgress(event.payload)
    })

    return () => {
      void unlisten.then((dispose) => dispose())
    }
  }, [])

  const runSample = async ({
    format,
    input,
    outputLocation,
    outputPath,
  }: Pick<IRunTranscribeInput, 'format' | 'input' | 'outputLocation' | 'outputPath'>) => {
    setOutput('')
    setTranscribeProgress({ stage: 'sample', message: 'Generating sample transcript', percent: 20 })
    setStatus('running')
    onMessage('Generating sample')

    try {
      const finalOutputPath = outputPath.trim() || (await resolveDefaultOutputPath(input, format, outputLocation))
      const response = await invoke<ICommandResponse>('export_sample', {
        request: { format, outputPath: finalOutputPath },
      })
      setOutput(response.output)
      setStatus('done')
      setTranscribeProgress(null)
      onMessage(response.wroteTo ? `Saved to ${response.wroteTo}` : 'Sample loaded')
    } catch (error) {
      setStatus('error')
      setTranscribeProgress(null)
      onMessage(String(error))
    }
  }

  const runTranscribe = async (input: IRunTranscribeInput) => {
    if (!input.input.trim() || !input.modelPath) {
      setStatus('error')
      onMessage('Choose media and an installed or custom model first')
      return
    }

    setOutput('')
    setTranscribeProgress({ stage: 'queued', message: 'Starting transcription', percent: 1 })
    setStatus('running')
    onMessage('Transcribing locally')

    try {
      const finalLanguage = input.language === 'mixed-th-en' ? 'auto' : input.language
      const finalOutputPath =
        input.outputPath.trim() || (await resolveDefaultOutputPath(input.input, input.format, input.outputLocation))
      const response = await invoke<ICommandResponse>('transcribe', {
        request: {
          input: input.input.trim(),
          model: input.modelPath,
          format: input.format,
          title: input.title.trim() || null,
          language: finalLanguage.trim() || null,
          ffmpegBin: input.ffmpegBin.trim() || null,
          whisperBin: input.whisperBin.trim() || null,
          keepTemp: input.keepTemp,
          outputPath: finalOutputPath,
          chunkMode: input.transcribeMode,
        },
      })
      setOutput(response.output)
      setStatus('done')
      setTranscribeProgress(null)
      onMessage(response.wroteTo ? `Saved to ${response.wroteTo}` : 'Transcription complete')
    } catch (error) {
      setStatus('error')
      setTranscribeProgress(null)
      onMessage(String(error))
    }
  }

  const copyOutput = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    onMessage('Copied')
  }

  const resetJob = () => {
    setOutput('')
    setStatus('idle')
    setTranscribeProgress(null)
  }

  return { copyOutput, output, resetJob, runSample, runTranscribe, setStatus, status, transcribeProgress }
}

export type { IRunTranscribeInput }
export { useTranscriptionJob }
