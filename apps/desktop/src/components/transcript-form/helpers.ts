const getFileName = (path: string) => path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? ''

const formatClock = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatLibraryDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  })
}

const formatLibraryDuration = (durationMs?: number | null) => {
  if (!durationMs) return 'Unknown duration'
  return formatClock(durationMs)
}

const getPathTail = (path: string, segmentCount = 2) => {
  if (!path) return ''
  const parts = path.replaceAll('\\', '/').split('/').filter(Boolean)
  if (parts.length <= segmentCount) return parts.join('/')
  return `.../${parts.slice(-segmentCount).join('/')}`
}

export { formatClock, formatLibraryDate, formatLibraryDuration, getFileName, getPathTail }
