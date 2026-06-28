import { downloadDir } from '@tauri-apps/api/path'
import { FORMAT_OPTIONS } from '../constants'
import type { ExportFormat, OutputLocation } from '../types'

const getFileStem = (path: string) => {
  const name = path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? ''
  return name.replace(/\.[^.]+$/, '')
}

const getSourceFolder = (path: string) => {
  const normalized = path.replaceAll('\\', '/')
  const parts = normalized.split('/')
  parts.pop()
  return parts.join('/')
}

const getSuggestedOutputName = (input: string, format: ExportFormat) => {
  const option = FORMAT_OPTIONS.find((item) => item.value === format)
  const stem = getFileStem(input) || 'otobun-transcript'
  return `${stem}.${option?.extension ?? format}`
}

const resolveDefaultOutputPath = async (input: string, format: ExportFormat, outputLocation: OutputLocation) => {
  const fileName = getSuggestedOutputName(input, format)

  if (outputLocation === 'source-folder' && input.trim()) {
    const folder = getSourceFolder(input)
    if (folder) return `${folder}/${fileName}`
  }

  const downloadsPath = await downloadDir()
  return `${downloadsPath}/Otobun/${fileName}`
}

export { getFileStem, getSourceFolder, getSuggestedOutputName, resolveDefaultOutputPath }
