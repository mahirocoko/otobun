import IconFolderOpen from '~icons/lucide/folder-open'
import IconMic from '~icons/lucide/mic'
import IconShieldCheck from '~icons/lucide/shield-check'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

const PermissionsPanel = () => (
  <Card className="panel-card narrow-panel">
    <CardHeader>
      <CardTitle>Permissions</CardTitle>
      <CardDescription>What Otobun needs to record and save files locally.</CardDescription>
    </CardHeader>
    <CardContent className="settings-stack">
      <div className="permission-row">
        <IconMic />
        <div>
          <strong>Microphone</strong>
          <p>Used only when you press Record. Audio stays on this Mac.</p>
        </div>
        <span className="state-chip is-ready">Prompt on first use</span>
      </div>
      <div className="permission-row">
        <IconFolderOpen />
        <div>
          <strong>Files and folders</strong>
          <p>Used for imported media, downloaded models, recordings, and transcript exports.</p>
        </div>
        <span className="state-chip is-ready">Local files</span>
      </div>
      <div className="notice-box">
        <IconShieldCheck />
        <span>If recording does not start, check System Settings → Privacy & Security → Microphone.</span>
      </div>
    </CardContent>
  </Card>
)

export { PermissionsPanel }
