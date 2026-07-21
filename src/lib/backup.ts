// Data portability: export / import / wipe the competitor's entire local
// season. Because everything lives in localStorage, a competitor could lose
// their whole record by clearing their browser or switching devices — so this
// bundles all four stores into one downloadable JSON file and restores it
// exactly, giving them real ownership of their data.
//
// Reuses each store's own validator on import, so a tampered or partial file
// degrades gracefully (bad pieces drop) instead of corrupting state.

import {
  clearArchive,
  loadArchive,
  parseArchive,
  replaceArchive,
  type ArchivedRun
} from './archive'
import {
  clearHistory,
  loadHistory,
  parseHistory,
  replaceHistory,
  type RunRecord
} from './history'
import {
  clearProfileAndLog,
  loadLog,
  loadProfile,
  parseLog,
  parseProfile,
  replaceLog,
  saveProfile,
  type CompetitorProfile,
  type LogEntry
} from './profile'

export interface Backup {
  app: 'dry-run'
  version: 1
  exportedAt: number
  profile: CompetitorProfile | null
  log: LogEntry[]
  archive: ArchivedRun[]
  history: RunRecord[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Assemble the current state into a backup object. */
export const buildBackup = (): Backup => ({
  app: 'dry-run',
  version: 1,
  exportedAt: Date.now(),
  profile: loadProfile(),
  log: loadLog(),
  archive: loadArchive(),
  history: loadHistory()
})

/**
 * Validate a raw backup string. Each nested store is run through its own
 * parser, so partial/corrupt sections are dropped rather than failing the whole
 * import. Returns null only when the file isn't a Dry Run backup at all.
 */
export const parseBackup = (raw: string): Backup | null => {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(data) || data.app !== 'dry-run') return null
  return {
    app: 'dry-run',
    version: 1,
    exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : Date.now(),
    profile: parseProfile(data.profile === null ? null : JSON.stringify(data.profile)),
    log: parseLog(JSON.stringify(data.log ?? [])),
    archive: parseArchive(JSON.stringify(data.archive ?? [])),
    history: parseHistory(JSON.stringify(data.history ?? []))
  }
}

/** Write a validated backup into all stores, replacing current data. */
export const restoreBackup = (backup: Backup): void => {
  if (backup.profile) saveProfile(backup.profile)
  else clearProfileAndLog()
  replaceLog(backup.log)
  replaceArchive(backup.archive)
  replaceHistory(backup.history)
}

/** Trigger a download of the current data as a timestamped JSON file. */
export const downloadBackup = (): void => {
  const backup = buildBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date(backup.exportedAt).toISOString().slice(0, 10)
  a.href = url
  a.download = `dry-run-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Wipe every store (profile, log, archive, history). */
export const wipeAllData = (): void => {
  clearProfileAndLog()
  clearArchive()
  clearHistory()
}
