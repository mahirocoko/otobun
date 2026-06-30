import type { AppSection, JobState } from '../types'

interface IHeroCardProps {
  message: string
  status: JobState
  activeSection: AppSection
}

const SECTION_TITLES: Record<AppSection, string> = {
  transcribe: 'Transcribe',
  library: 'History',
  models: 'Models',
  permissions: 'Permissions',
  settings: 'Settings',
}

const HeroCard = ({ activeSection, message, status }: IHeroCardProps) => {
  return (
    <header className="app-header">
      <div className="header-title-block">
        <h1>{SECTION_TITLES[activeSection]}</h1>
      </div>
      <div className="status-line">
        <span className={`status-dot status-${status}`} />
        <span>{message}</span>
      </div>
    </header>
  )
}

export { HeroCard }
