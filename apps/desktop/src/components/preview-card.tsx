import { convertFileSrc } from '@tauri-apps/api/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import IconCopy from '~icons/lucide/copy'
import IconFileText from '~icons/lucide/file-text'
import IconPause from '~icons/lucide/pause'
import IconPlay from '~icons/lucide/play'
import IconRotateCcw from '~icons/lucide/rotate-ccw'
import type { ExportFormat, ITranscribeResultMeta, ITranscript } from '../types'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

interface IPreviewCardProps {
  output: string
  format: ExportFormat
  input: string
  meta: ITranscribeResultMeta
  transcript?: ITranscript | null
  onCopy: () => void
  onNewTranscript: () => void
}

interface ISegment {
  time: string
  startMs: number | null
  speaker: string
  text: string
}

const formatClock = (durationSeconds: number) => {
  const totalSeconds = Math.max(0, Math.round(durationSeconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatElapsed = (durationMs?: number | null) => {
  if (!durationMs) return null
  return formatClock(durationMs / 1000)
}

const parseCompactTimestamp = (value: string) => {
  const parts = value.split(':').map((part) => Number.parseInt(part, 10))
  if (parts.some((part) => Number.isNaN(part))) return null
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
  if (parts.length === 3) return ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000
  return null
}

const formatSegmentTime = (startMs: number) => {
  const seconds = Math.floor(startMs / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

const PreviewCard = ({ output, format, input, meta, transcript, onCopy, onNewTranscript }: IPreviewCardProps) => {
  const [viewMode, setViewMode] = useState<'reader' | 'source'>('reader')
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [followPlayback, setFollowPlayback] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rowRefs = useRef<Array<HTMLElement | null>>([])
  const manualScrollPauseUntilRef = useRef(0)
  const audioSource = useMemo(() => (input ? convertFileSrc(input) : ''), [input])

  const parsedSegments = useMemo<ISegment[]>(() => {
    if (transcript && Array.isArray(transcript.segments)) {
      return transcript.segments.map((segment) => {
        const startMs = segment.range.startMs
        const speaker = segment.speakerId
          ? transcript.speakers?.find((s) => s.id === segment.speakerId)?.label || 'Transcript'
          : 'Transcript'
        return {
          time: formatSegmentTime(startMs),
          startMs,
          speaker,
          text: segment.text || '',
        }
      })
    }

    if (!output.trim()) return []

    try {
      if (format === 'json' || output.trim().startsWith('{') || output.trim().startsWith('[')) {
        const data = JSON.parse(output)
        const rawSegments = data.segments || (Array.isArray(data) ? data : [])
        if (Array.isArray(rawSegments)) {
          return rawSegments.map(
            (segment: {
              start_ms?: number
              start?: number
              speaker?: string
              speaker_id?: string | number
              text?: string
            }) => {
              const startMs = segment.start_ms ?? (segment.start ? Math.round(segment.start * 1000) : 0)

              return {
                time: formatSegmentTime(startMs),
                startMs,
                speaker: segment.speaker || 'Transcript',
                text: segment.text || '',
              }
            },
          )
        }
      }

      if (format === 'srt') {
        return output
          .split('\n\n')
          .filter(Boolean)
          .map((block) => {
            const lines = block.split('\n').filter(Boolean)
            if (lines.length >= 3) {
              const match = lines[1].match(/(\d{2}:\d{2}:\d{2})/)
              const startMs = match ? parseCompactTimestamp(match[1]) : null
              return {
                time: startMs === null ? '00:00' : formatSegmentTime(startMs),
                startMs,
                speaker: 'Transcript',
                text: lines.slice(2).join(' '),
              }
            }

            return { time: '00:00', startMs: null, speaker: 'Transcript', text: block }
          })
      }

      if (format === 'vtt') {
        return output
          .replace('WEBVTT\n\n', '')
          .split('\n\n')
          .filter(Boolean)
          .map((block) => {
            const lines = block.split('\n').filter(Boolean)
            if (lines.length >= 2) {
              const timeLine = lines[0].includes('-->') ? lines[0] : lines[1] || ''
              const textLines = lines[0].includes('-->') ? lines.slice(1) : lines.slice(2)
              const match = timeLine.match(/(\d{2}:\d{2}:\d{2})/)
              const startMs = match ? parseCompactTimestamp(match[1]) : null
              return {
                time: startMs === null ? '00:00' : formatSegmentTime(startMs),
                startMs,
                speaker: 'Transcript',
                text: textLines.join(' '),
              }
            }

            return { time: '00:00', startMs: null, speaker: 'Transcript', text: block }
          })
      }

      if (format === 'md') {
        const segments: ISegment[] = []
        let currentSegment: ISegment | null = null

        const commitSegment = () => {
          if (!currentSegment) return
          if (currentSegment.text.trim()) {
            segments.push({ ...currentSegment, text: currentSegment.text.trim() })
          }
          currentSegment = null
        }

        for (const rawLine of output.split('\n')) {
          const line = rawLine.trim()
          if (!line || line.startsWith('# ') || line.startsWith('_Source:')) continue

          const currentMarkdownMatch = line.match(/^\*\*(.*?)\*\*\s+`?(\d{2}:\d{2})`?\s*(.*)$/)
          if (currentMarkdownMatch) {
            commitSegment()
            const startMs = parseCompactTimestamp(currentMarkdownMatch[2])
            currentSegment = {
              time: currentMarkdownMatch[2],
              startMs,
              speaker: currentMarkdownMatch[1].trim() || 'Transcript',
              text: currentMarkdownMatch[3].trim(),
            }
            continue
          }

          const legacyMarkdownMatch = line.match(/-\s+\*\*([^[]*?)\[?(\d{2}:\d{2})\]?\*\*:\s*(.*)/)
          if (legacyMarkdownMatch) {
            commitSegment()
            const startMs = parseCompactTimestamp(legacyMarkdownMatch[2])
            segments.push({
              time: legacyMarkdownMatch[2],
              startMs,
              speaker: legacyMarkdownMatch[1].trim() || 'Transcript',
              text: legacyMarkdownMatch[3].trim(),
            })
            continue
          }

          if (currentSegment) {
            currentSegment.text = [currentSegment.text, line].filter(Boolean).join(' ')
          }
        }

        commitSegment()
        if (segments.length > 0) return segments
      }
    } catch (error) {
      console.warn('Transcript preview parser fallback:', error)
    }

    return output
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => ({ time: '--:--', startMs: null, speaker: 'Transcript', text: line }))
  }, [output, format, transcript])

  const activeSegmentIndex = useMemo(() => {
    const currentMs = audioCurrentTime * 1000
    let activeIndex = -1

    for (let index = 0; index < parsedSegments.length; index += 1) {
      const segment = parsedSegments[index]
      if (segment.startMs === null || segment.startMs > currentMs) continue
      activeIndex = index
    }

    return activeIndex
  }, [audioCurrentTime, parsedSegments])

  useEffect(() => {
    if (!isPlaying || !followPlayback || viewMode !== 'reader' || activeSegmentIndex < 0) return
    if (Date.now() < manualScrollPauseUntilRef.current) return
    rowRefs.current[activeSegmentIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeSegmentIndex, isPlaying, followPlayback, viewMode])

  const pauseAutoScroll = () => {
    manualScrollPauseUntilRef.current = Date.now() + 6000
  }

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      await audio.play()
    } else {
      audio.pause()
    }
  }

  const seekToSegment = (startMs: number | null) => {
    if (startMs === null || !audioRef.current) return
    audioRef.current.currentTime = startMs / 1000
    setAudioCurrentTime(startMs / 1000)
  }

  const handleTimelineClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    const track = event.currentTarget
    const rect = track.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const width = rect.width
    if (width === 0 || audioDuration === 0 || !audioRef.current) return
    const clickRatio = Math.max(0, Math.min(1, clickX / width))
    const targetTime = clickRatio * audioDuration
    audioRef.current.currentTime = targetTime
    setAudioCurrentTime(targetTime)
  }

  const progressRatio = audioDuration > 0 ? audioCurrentTime / audioDuration : 0
  const elapsedLabel = formatElapsed(meta.elapsedMs)

  return (
    <Card className="preview-card result-preview-card">
      <CardHeader className="preview-header">
        <div>
          <CardTitle>Output</CardTitle>
          <p className="preview-subtitle">Review the transcript result, then start another pass when ready.</p>
          {output ? (
            <dl className="result-summary-list">
              <div>
                <dt>Format</dt>
                <dd>{format.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Segments</dt>
                <dd>{parsedSegments.length}</dd>
              </div>
              {elapsedLabel ? (
                <div>
                  <dt>Time</dt>
                  <dd>{elapsedLabel}</dd>
                </div>
              ) : null}
              {meta.wroteTo ? (
                <div className="result-summary-path">
                  <dt>Saved</dt>
                  <dd title={meta.wroteTo}>{meta.wroteTo}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
        <div className="preview-actions">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'reader' | 'source')}>
            <TabsList>
              <TabsTrigger value="reader">Reader</TabsTrigger>
              <TabsTrigger value="source">Raw</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button disabled={!output} onClick={onCopy} size="sm" type="button" variant="secondary">
            <IconCopy />
            Copy
          </Button>
          <Button onClick={onNewTranscript} size="sm" type="button">
            <IconRotateCcw />
            New transcript
          </Button>
        </div>
      </CardHeader>
      <CardContent className="preview-body">
        {output ? (
          <>
            {audioSource ? (
              <div className="result-audio-player">
                {/* biome-ignore lint/a11y/useMediaCaption: source audio is paired with the generated transcript reader */}
                <audio
                  ref={audioRef}
                  src={audioSource}
                  onEnded={() => setIsPlaying(false)}
                  onLoadedMetadata={(event) => {
                    setAudioDuration(event.currentTarget.duration || 0)
                    setAudioCurrentTime(event.currentTarget.currentTime || 0)
                  }}
                  onPause={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onTimeUpdate={(event) => setAudioCurrentTime(event.currentTarget.currentTime || 0)}
                />
                <div className="result-audio-side">
                  <Button onClick={() => void togglePlayback()} size="icon" type="button" variant="secondary">
                    {isPlaying ? <IconPause /> : <IconPlay />}
                  </Button>
                  <div>
                    <strong>Playback</strong>
                    <span>
                      {formatClock(audioCurrentTime)} / {audioDuration > 0 ? formatClock(audioDuration) : '--:--'}
                    </span>
                  </div>
                </div>
                <div className="result-audio-main">
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: timeline click is pointer-only */}
                  <span
                    className="progress-track"
                    aria-label="Audio playback progress"
                    role="progressbar"
                    onClick={handleTimelineClick}
                    style={{ cursor: 'pointer' }}
                  >
                    <span style={{ width: `${Math.max(0, Math.min(100, progressRatio * 100))}%` }} />
                  </span>
                  <div className="result-audio-actions">
                    <label className="sync-reader-label">
                      <input
                        type="checkbox"
                        checked={followPlayback}
                        onChange={(event) => setFollowPlayback(event.target.checked)}
                      />
                      <span>Sync Reader</span>
                    </label>
                  </div>
                </div>
              </div>
            ) : null}
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'reader' | 'source')}>
              <TabsContent value="reader">
                <div className="reader-list" onPointerDown={pauseAutoScroll} onWheel={pauseAutoScroll}>
                  {parsedSegments.map((segment, index) => {
                    return (
                      // biome-ignore lint/a11y/useKeyWithClickEvents: seek on row click is pointer-only
                      <article
                        className={index === activeSegmentIndex ? 'reader-row is-active' : 'reader-row'}
                        // biome-ignore lint/suspicious/noArrayIndexKey: preview order is static for current output
                        key={`${segment.time}-${index}`}
                        ref={(node) => {
                          rowRefs.current[index] = node
                        }}
                        onClick={() => seekToSegment(segment.startMs)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="reader-row-meta">
                          <span>{segment.speaker}</span>
                          <code>{segment.time}</code>
                        </div>
                        <p>{segment.text}</p>
                      </article>
                    )
                  })}
                </div>
              </TabsContent>
              <TabsContent value="source">
                <pre className="raw-output">{output}</pre>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="empty-state">
            <IconFileText />
            <strong>No transcript yet</strong>
            <span>Import media, choose a model, then run a sample or transcription.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { PreviewCard }
