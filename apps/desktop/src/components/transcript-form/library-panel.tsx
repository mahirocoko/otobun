import IconExternalLink from '~icons/lucide/external-link'
import IconFileText from '~icons/lucide/file-text'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconRefreshCw from '~icons/lucide/refresh-cw'
import IconTrash2 from '~icons/lucide/trash-2'
import type { AppSection, ILibraryEntry } from '../../types'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { formatLibraryDate, formatLibraryDuration, getPathTail } from './helpers'

interface ILibraryPanelProps {
  libraryEntries: ILibraryEntry[]
  onChangeActiveSection: (value: AppSection) => void
  onDeleteLibraryEntry: (id: string) => void
  onOpenLibraryOutput: (id: string) => void
  onRefreshLibrary: () => void
  onRevealLibraryOutput: (id: string) => void
}

const LibraryPanel = ({
  libraryEntries,
  onChangeActiveSection,
  onDeleteLibraryEntry,
  onOpenLibraryOutput,
  onRefreshLibrary,
  onRevealLibraryOutput,
}: ILibraryPanelProps) => (
  <Card className="panel-card library-panel">
    <CardHeader className="library-header">
      <div>
        <CardTitle>History</CardTitle>
        <CardDescription>Local transcripts saved on this Mac.</CardDescription>
      </div>
      <Button onClick={onRefreshLibrary} size="sm" type="button" variant="secondary">
        <IconRefreshCw />
        Refresh
      </Button>
    </CardHeader>
    <CardContent>
      {libraryEntries.length > 0 ? (
        <div className="library-list">
          {libraryEntries.map((entry) => (
            <article className="library-row" key={entry.id}>
              <div className="library-row-main">
                <div className="library-row-title">
                  <IconFileText />
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{formatLibraryDate(entry.createdAt)}</span>
                  </div>
                </div>
                <div className="library-paths">
                  <code title={entry.sourcePath}>Source · {getPathTail(entry.sourcePath, 2)}</code>
                  <code title={entry.outputPath}>Output · {getPathTail(entry.outputPath, 2)}</code>
                </div>
                <div className="library-meta-row">
                  <span title={entry.modelPath || entry.modelLabel}>{entry.modelLabel}</span>
                  <span>{entry.language}</span>
                  <span>{entry.format.toUpperCase()}</span>
                  <span>{entry.transcribeMode === 'smart' ? 'Smart chunks' : 'Single pass'}</span>
                  <span>{formatLibraryDuration(entry.durationMs)}</span>
                  <span>{entry.segmentCount} segments</span>
                </div>
              </div>
              <div className="library-row-actions">
                <Button onClick={() => onOpenLibraryOutput(entry.id)} size="sm" type="button" variant="secondary">
                  <IconExternalLink />
                  Open
                </Button>
                <Button onClick={() => onRevealLibraryOutput(entry.id)} size="sm" type="button" variant="ghost">
                  <IconFolderOpen />
                  Reveal
                </Button>
                <Button onClick={() => onDeleteLibraryEntry(entry.id)} size="sm" type="button" variant="ghost">
                  <IconTrash2 />
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="library-empty-state">
          <IconFileText />
          <strong>No transcripts yet</strong>
          <p>Finished transcripts will appear here with their exported file.</p>
          <Button onClick={() => onChangeActiveSection('transcribe')} type="button">
            Start transcribing
          </Button>
        </div>
      )}
    </CardContent>
  </Card>
)

export { LibraryPanel }
