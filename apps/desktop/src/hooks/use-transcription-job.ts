import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useRef, useState } from 'react'
import type {
  DecodeProfile,
  ExportFormat,
  ICancelTranscribeResponse,
  ICommandResponse,
  ITranscribeActivityItem,
  ITranscribeProgress,
  ITranscript,
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
  decodeProfile: DecodeProfile
  modelPath?: string
  outputLocation: OutputLocation
  outputPath: string
  title: string
  transcribeMode: TranscribeMode
  whisperBin: string
  onComplete?: (context: ITranscribeCompleteContext) => Promise<void> | void
}

interface ITranscribeCompleteContext {
  finalLanguage: string
  finalOutputPath: string
  response: ICommandResponse
  request: IRunTranscribeInput
}

const useTranscriptionJob = (onMessage: (message: string) => void) => {
  const [output, setOutput] = useState('')
  const [transcript, setTranscript] = useState<ITranscript | null>(null)
  const [status, setStatus] = useState<JobState>('idle')
  const [isCancelling, setIsCancelling] = useState(false)
  const [transcribeProgress, setTranscribeProgress] = useState<ITranscribeProgress | null>(null)
  const [activityLog, setActivityLog] = useState<ITranscribeActivityItem[]>([])
  const [resultMeta, setResultMeta] = useState({ elapsedMs: null as number | null, wroteTo: null as string | null })
  const lastActivityKeyRef = useRef('')

  const pushActivity = (label: string, detail?: string) => {
    const key = `${label}:${detail ?? ''}`
    if (lastActivityKeyRef.current === key) return
    lastActivityKeyRef.current = key
    setActivityLog((items) => [
      ...items.slice(-7),
      {
        id: `${Date.now()}-${items.length}`,
        label,
        detail,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
  }

  const resetActivity = (label: string, detail?: string) => {
    lastActivityKeyRef.current = ''
    setActivityLog([])
    pushActivity(label, detail)
  }

  useEffect(() => {
    const unlisten = listen<ITranscribeProgress>('transcribe-progress', (event) => {
      const progress = event.payload
      setTranscribeProgress(progress)
      const chunkDetail =
        progress.chunkIndex && progress.chunkTotal
          ? `Chunk ${progress.chunkIndex} of ${progress.chunkTotal}`
          : undefined
      pushActivity(progress.message, chunkDetail)
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
    setTranscript(null)
    setResultMeta({ elapsedMs: null, wroteTo: null })
    setTranscribeProgress({ stage: 'sample', message: 'Generating sample transcript', percent: 20 })
    resetActivity('Generating sample transcript')
    setIsCancelling(false)
    setStatus('running')
    onMessage('Generating sample')

    try {
      const finalOutputPath = outputPath.trim() || (await resolveDefaultOutputPath(input, format, outputLocation))
      const response = await invoke<ICommandResponse>('export_sample', {
        request: { format, outputPath: finalOutputPath },
      })
      setOutput(response.output)
      setTranscript(response.transcript ?? null)
      setResultMeta({ elapsedMs: response.elapsedMs ?? null, wroteTo: response.wroteTo ?? null })
      setStatus('done')
      setTranscribeProgress(null)
      setIsCancelling(false)
      pushActivity(response.wroteTo ? 'Sample saved' : 'Sample ready', response.wroteTo ?? undefined)
      onMessage(response.wroteTo ? `Saved to ${response.wroteTo}` : 'Sample loaded')
    } catch (error) {
      setStatus('error')
      setTranscribeProgress(null)
      setIsCancelling(false)
      pushActivity('Sample failed', String(error))
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
    setTranscript(null)
    setResultMeta({ elapsedMs: null, wroteTo: null })
    setTranscribeProgress({ stage: 'queued', message: 'Starting transcription', percent: 1 })
    resetActivity('Starting transcription')
    setIsCancelling(false)
    setStatus('running')
    onMessage('Transcribing locally')

    try {
      const finalLanguage =
        input.decodeProfile === 'thai-dialogue' && (input.language === 'mixed-th-en' || input.language === 'auto')
          ? 'th'
          : input.language === 'mixed-th-en'
            ? 'auto'
            : input.language
      const finalOutputPath =
        input.outputPath.trim() || (await resolveDefaultOutputPath(input.input, input.format, input.outputLocation))
      const response = await invoke<ICommandResponse>('transcribe', {
        request: {
          input: input.input.trim(),
          model: input.modelPath,
          format: input.format,
          title: input.title.trim() || null,
          language: finalLanguage.trim() || null,
          decodeProfile: input.decodeProfile,
          ffmpegBin: input.ffmpegBin.trim() || null,
          whisperBin: input.whisperBin.trim() || null,
          keepTemp: input.keepTemp,
          outputPath: finalOutputPath,
          chunkMode: input.transcribeMode,
        },
      })
      setOutput(response.output)
      setTranscript(response.transcript ?? null)
      setResultMeta({ elapsedMs: response.elapsedMs ?? null, wroteTo: response.wroteTo ?? null })
      setStatus('done')
      setTranscribeProgress(null)
      setIsCancelling(false)
      await input.onComplete?.({
        finalLanguage,
        finalOutputPath,
        request: input,
        response,
      })
      pushActivity(response.wroteTo ? 'Transcript saved' : 'Transcript ready', response.wroteTo ?? undefined)
      onMessage(response.wroteTo ? `Saved to ${response.wroteTo}` : 'Transcription complete')
    } catch (error) {
      if (String(error).toLowerCase().includes('cancelled')) {
        setStatus('idle')
        setTranscribeProgress(null)
        setIsCancelling(false)
        pushActivity('Transcription cancelled')
        onMessage('Transcription cancelled')
        return
      }
      setStatus('error')
      setTranscribeProgress(null)
      setIsCancelling(false)
      pushActivity('Transcription failed', String(error))
      onMessage(String(error))
    }
  }

  const cancelTranscribe = async () => {
    if (status !== 'running') return
    setIsCancelling(true)
    pushActivity('Cancel requested')
    setTranscribeProgress((current) => ({
      stage: 'cancelling',
      message: 'Cancelling transcription',
      percent: current?.percent ?? null,
      chunkIndex: current?.chunkIndex,
      chunkTotal: current?.chunkTotal,
      chunkStartMs: current?.chunkStartMs,
      chunkEndMs: current?.chunkEndMs,
    }))
    onMessage('Cancelling transcription')

    try {
      const response = await invoke<ICancelTranscribeResponse>('cancel_transcribe')
      if (!response.cancelled) {
        setIsCancelling(false)
        onMessage(response.message)
      }
    } catch (error) {
      setIsCancelling(false)
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
    setTranscript(null)
    setResultMeta({ elapsedMs: null, wroteTo: null })
    setStatus('idle')
    setIsCancelling(false)
    setTranscribeProgress(null)
    setActivityLog([])
    lastActivityKeyRef.current = ''
  }

  return {
    copyOutput,
    activityLog,
    cancelTranscribe,
    isCancelling,
    output,
    transcript,
    resetJob,
    resultMeta,
    runSample,
    runTranscribe,
    setStatus,
    status,
    transcribeProgress,
  }
}

export type { IRunTranscribeInput }
export { useTranscriptionJob }
