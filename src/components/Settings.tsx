import { useRef, useState } from 'react'

import { downloadBackup, parseBackup, restoreBackup, wipeAllData } from '../lib/backup'

// Settings overlay: own your data. Export the whole season to a file, restore
// it on another device, or wipe everything. Local-first means the competitor's
// record is theirs — this makes that literal.

interface SettingsProps {
  /** Called after a successful import or a wipe so the app reloads from storage. */
  onDataChanged: () => void
  onClose: () => void
}

export const Settings = ({ onDataChanged, onClose }: SettingsProps): JSX.Element => {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [confirmingWipe, setConfirmingWipe] = useState(false)

  const handleImport = (file: File | null): void => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const backup = parseBackup(String(reader.result ?? ''))
      if (!backup) {
        setNote({ tone: 'err', text: "That doesn't look like a Dry Run backup file." })
        return
      }
      restoreBackup(backup)
      setNote({
        tone: 'ok',
        text: `Restored ${backup.archive.length} take${backup.archive.length === 1 ? '' : 's'}${backup.profile ? ` for ${backup.profile.name}` : ''}.`
      })
      onDataChanged()
    }
    reader.onerror = () => setNote({ tone: 'err', text: 'Could not read that file.' })
    reader.readAsText(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const wipe = (): void => {
    wipeAllData()
    setConfirmingWipe(false)
    setNote({ tone: 'ok', text: 'All local data cleared.' })
    onDataChanged()
  }

  return (
    <div className="launch-overlay onboarding" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="onboard-card settings-card">
        <div className="settings-head">
          <div>
            <p className="label">Settings</p>
            <h2 className="onboard-title">Your data</h2>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="settings-lead">
          Everything you do lives on this device only — no account, no server.
          Back it up or move it whenever you like.
        </p>

        <div className="settings-row">
          <div>
            <p className="settings-row-title">Export your season</p>
            <p className="settings-row-sub">
              Download your profile, streak, achievements and every archived take
              as a single file.
            </p>
          </div>
          <button className="btn btn--primary btn--sm" onClick={downloadBackup}>
            Export data
          </button>
        </div>

        <div className="settings-row">
          <div>
            <p className="settings-row-title">Import a backup</p>
            <p className="settings-row-sub">
              Restore from a Dry Run backup file — replaces what&rsquo;s on this
              device.
            </p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            Choose file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            aria-label="Choose a backup file to import"
            onChange={(e) => handleImport(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="settings-row settings-row--danger">
          <div>
            <p className="settings-row-title">Clear all data</p>
            <p className="settings-row-sub">
              Wipe your profile, log, achievements and takes from this device.
              This can&rsquo;t be undone.
            </p>
          </div>
          {confirmingWipe ? (
            <div className="settings-confirm">
              <button className="btn btn--danger btn--sm" onClick={wipe}>
                Yes, wipe it
              </button>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirmingWipe(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn btn--ghost btn--sm settings-danger-btn"
              onClick={() => setConfirmingWipe(true)}
            >
              Clear data
            </button>
          )}
        </div>

        {note && (
          <p className={`settings-note settings-note--${note.tone}`} role="status">
            {note.text}
          </p>
        )}
      </div>
    </div>
  )
}
