import { convertFileSrc } from '@tauri-apps/api/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import IconPause from '~icons/lucide/pause'
import IconPlay from '~icons/lucide/play'
import { Button } from './ui/button'

interface IAudioWaveformPlayerProps {
  path: string
  title?: string
}

const formatClock = (durationSeconds: number) => {
  const totalSeconds = Math.max(0, Math.round(durationSeconds))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const AudioWaveformPlayer = ({ path, title = 'Listen before using' }: IAudioWaveformPlayerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const waveSurferRef = useRef<WaveSurfer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const source = useMemo(() => (path ? convertFileSrc(path) : ''), [path])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !source) return

    setIsReady(false)
    setHasError(false)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)

    const waveSurfer = WaveSurfer.create({
      container,
      url: source,
      height: 76,
      normalize: true,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      cursorColor: 'rgba(255, 106, 74, 0.8)',
      cursorWidth: 1,
      dragToSeek: true,
      progressColor: '#ff7b5f',
      waveColor: 'rgba(235, 243, 240, 0.18)',
    })
    waveSurferRef.current = waveSurfer

    waveSurfer.on('ready', () => {
      setIsReady(true)
      setDuration(waveSurfer.getDuration())
    })
    waveSurfer.on('play', () => setIsPlaying(true))
    waveSurfer.on('pause', () => setIsPlaying(false))
    waveSurfer.on('finish', () => setIsPlaying(false))
    waveSurfer.on('timeupdate', (time) => setCurrentTime(time))
    waveSurfer.on('error', () => {
      setIsReady(false)
      setHasError(true)
    })

    return () => {
      waveSurfer.destroy()
      waveSurferRef.current = null
    }
  }, [source])

  const togglePlayback = () => {
    void waveSurferRef.current?.playPause()
  }

  return (
    <div className="audio-waveform-card">
      <div className="audio-waveform-side">
        <Button disabled={!isReady} onClick={togglePlayback} size="icon" type="button" variant="secondary">
          {isPlaying ? <IconPause /> : <IconPlay />}
        </Button>
        <div>
          <strong>{title}</strong>
          <span>
            {formatClock(currentTime)} / {duration > 0 ? formatClock(duration) : '--:--'}
          </span>
        </div>
      </div>
      <div className="audio-waveform-main">
        {hasError ? (
          <div className="audio-waveform-fallback">Waveform preview is unavailable for this file.</div>
        ) : (
          <div className="audio-waveform" ref={containerRef} />
        )}
      </div>
    </div>
  )
}

export { AudioWaveformPlayer }
