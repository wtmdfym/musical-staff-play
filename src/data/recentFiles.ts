const STORAGE_KEY = 'musicalStaffPlay_recentFiles'
const MAX_ITEMS = 10

export interface RecentFileEntry {
  name: string
  timestamp: number
}

export function getRecentFiles(): RecentFileEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function addRecentFile(name: string): void {
  try {
    const files = getRecentFiles().filter((f) => f.name !== name)
    files.unshift({ name, timestamp: Date.now() })
    if (files.length > MAX_ITEMS) files.pop()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files))
  } catch {
    // ignore
  }
}
