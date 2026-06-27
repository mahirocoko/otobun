import { useMemo, useState } from 'react'
import IconCopy from '~icons/lucide/copy'
import IconFileText from '~icons/lucide/file-text'
import type { ExportFormat } from '../types'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

interface IPreviewCardProps {
  output: string
  format: ExportFormat
  onCopy: () => void
}

interface ISegment {
  time: string
  speaker: string
  text: string
}

const PreviewCard = ({ output, format, onCopy }: IPreviewCardProps) => {
  const [viewMode, setViewMode] = useState<'reader' | 'source'>('reader')

  const parsedSegments = useMemo<ISegment[]>(() => {
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
              const seconds = Math.floor(startMs / 1000)
              const minutes = Math.floor(seconds / 60)
              const remainingSeconds = seconds % 60

              return {
                time: `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`,
                speaker: segment.speaker || `Speaker ${segment.speaker_id || 1}`,
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
              const match = lines[1].match(/(\d{2}):(\d{2}):(\d{2})/)
              return {
                time: match ? `${match[2]}:${match[3]}` : '00:00',
                speaker: 'Speaker 1',
                text: lines.slice(2).join(' '),
              }
            }

            return { time: '00:00', speaker: 'Speaker 1', text: block }
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
              const match = timeLine.match(/(\d{2}):(\d{2}):(\d{2})/)
              return {
                time: match ? `${match[2]}:${match[3]}` : '00:00',
                speaker: 'Speaker 1',
                text: textLines.join(' '),
              }
            }

            return { time: '00:00', speaker: 'Speaker 1', text: block }
          })
      }

      if (format === 'md') {
        const segments: ISegment[] = []

        for (const line of output.split('\n').filter(Boolean)) {
          const markdownMatch = line.match(/-\s+\*\*([^[]*?)\[?(\d{2}:\d{2})\]?\*\*:\s*(.*)/)
          if (markdownMatch) {
            segments.push({
              time: markdownMatch[2],
              speaker: markdownMatch[1].trim() || 'Speaker 1',
              text: markdownMatch[3].trim(),
            })
            continue
          }

          const simpleMatch = line.match(/-\s+\*\*\[?(\d{2}:\d{2})\]?\*\*\s+(.*)/)
          if (simpleMatch) {
            segments.push({ time: simpleMatch[1], speaker: 'Speaker 1', text: simpleMatch[2].trim() })
          }
        }

        if (segments.length > 0) return segments
      }
    } catch (error) {
      console.warn('Transcript preview parser fallback:', error)
    }

    return output
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => ({ time: '--:--', speaker: 'Transcript', text: line }))
  }, [output, format])

  return (
    <Card className="preview-card">
      <CardHeader className="preview-header">
        <CardTitle>Output</CardTitle>
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
        </div>
      </CardHeader>
      <CardContent className="preview-body">
        {output ? (
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'reader' | 'source')}>
            <TabsContent value="reader">
              <div className="reader-list">
                {parsedSegments.map((segment, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: preview order is static for current output
                  <article className="reader-row" key={`${segment.time}-${index}`}>
                    <div className="reader-row-meta">
                      <span>{segment.speaker}</span>
                      <code>{segment.time}</code>
                    </div>
                    <p>{segment.text}</p>
                  </article>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="source">
              <textarea className="raw-output" readOnly value={output} />
            </TabsContent>
          </Tabs>
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
