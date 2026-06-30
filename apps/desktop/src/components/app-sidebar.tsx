import IconDownload from '~icons/lucide/download'
import IconFileAudio from '~icons/lucide/file-audio'
import IconHistory from '~icons/lucide/history'
import IconMic from '~icons/lucide/mic'
import IconSettings from '~icons/lucide/settings'
import logo from '../assets/otobun-logo-selected.png'
import type { AppSection } from '../types'
import { cn } from '../utils/cn'
import { Button } from './ui/button'

interface INavItem {
  value: AppSection
  label: string
  icon: typeof IconFileAudio
}

interface IAppSidebarProps {
  activeSection: AppSection
  onChangeSection: (section: AppSection) => void
}

const NAV_ITEMS: INavItem[] = [
  { value: 'transcribe', label: 'Transcribe', icon: IconFileAudio },
  { value: 'library', label: 'History', icon: IconHistory },
  { value: 'models', label: 'Models', icon: IconDownload },
  { value: 'permissions', label: 'Permissions', icon: IconMic },
  { value: 'settings', label: 'Settings', icon: IconSettings },
]

const AppSidebar = ({ activeSection, onChangeSection }: IAppSidebarProps) => (
  <aside className="app-sidebar">
    <div className="sidebar-brand">
      <img alt="Otobun" className="brand-logo" src={logo} />
      <div>
        <strong>Otobun</strong>
        <span>local transcript desk</span>
      </div>
    </div>

    <nav aria-label="Main navigation" className="sidebar-nav">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon

        return (
          <Button
            className={cn('sidebar-link', activeSection === item.value && 'is-active')}
            key={item.value}
            onClick={() => onChangeSection(item.value)}
            type="button"
            variant="ghost"
          >
            <Icon />
            <span>{item.label}</span>
          </Button>
        )
      })}
    </nav>
  </aside>
)

export { AppSidebar }
