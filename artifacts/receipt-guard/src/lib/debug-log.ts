export interface DebugEntry {
  ts: number
  url: string
  status: number | null
  contentType: string | null
  bodySnippet: string | null
  isJson: boolean
  error: string | null
}

const entries: DebugEntry[] = []
const listeners: Array<() => void> = []

export function addEntry(e: DebugEntry) {
  entries.push(e)
  listeners.forEach(fn => fn())
}

export function getEntries(): DebugEntry[] {
  return entries
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i !== -1) listeners.splice(i, 1)
  }
}
