export function cellText(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value)
  }
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object') {
    const rec = value as { formula?: string; richText?: { text: string }[]; text?: string; result?: unknown }
    if (typeof rec.formula === 'string') return `=${rec.formula}`
    if (Array.isArray(rec.richText)) return rec.richText.map((part) => part.text).join('')
    if (typeof rec.text === 'string') return rec.text
    if (rec.result != null) return cellText(rec.result)
  }
  return String(value).trim()
}

export function splitIds(value: unknown): string[] {
  const raw = cellText(value)
  if (!raw || raw === '-' || raw === '—' || raw === '.') return raw === '.' ? ['.'] : []
  return raw
    .split(/[,，;；\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? String(Number(part)) : part))
}

export interface KeyedValue {
  id: string
  value: string
}

export function parseKeyed(raw: string): KeyedValue[] {
  if (!raw.trim()) return []
  return raw
    .split(/[;；]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf(':')
      if (index < 0) return { id: part, value: '' }
      return { id: part.slice(0, index).trim(), value: part.slice(index + 1).trim() }
    })
    .filter((item) => item.id)
}

export function formatKeyed(items: KeyedValue[]): string {
  return items
    .filter((item) => item.id)
    .map((item) => (item.value ? `${item.id}:${item.value}` : item.id))
    .join(';')
}

export interface GridPoint {
  x: string
  y: string
}

export function parsePoints(raw: string): GridPoint[] {
  if (!raw.trim()) return []
  return raw
    .split(/[;；]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [x, y] = part.split(/[,，]/)
      return { x: x?.trim() ?? '', y: y?.trim() ?? '' }
    })
}

export function formatPoints(items: GridPoint[]): string {
  return items
    .filter((item) => item.x || item.y)
    .map((item) => `${item.x},${item.y}`)
    .join(';')
}

export function joinIds(ids: string[]): string {
  return ids.filter(Boolean).join(',')
}

export function parseRouteSlot(raw: string): { routeId: string; position: string } | null {
  const text = raw.trim()
  const index = text.indexOf(':')
  if (index <= 0) return null
  const routeId = text.slice(0, index).trim()
  const position = text.slice(index + 1).trim()
  if (!routeId || !position) return null
  return { routeId, position }
}

export function formatRouteSlot(routeId: string, position: string): string {
  return `${routeId}:${position}`
}

export function nextNumericId(ids: string[]): string {
  let max = 0
  for (const id of ids) {
    if (/^\d+$/.test(id)) max = Math.max(max, Number(id))
  }
  return String(max + 1)
}

export function parsePool(value: string): { eventId: string; weight: string }[] {
  if (!value) return []
  return value
    .split(/[,，;；]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [eventId, weight] = part.split(':')
      return { eventId: eventId?.trim() ?? '', weight: weight?.trim() ?? '' }
    })
    .filter((item) => item.eventId)
}

export function formatPool(items: { eventId: string; weight: string }[]): string {
  return items
    .filter((item) => item.eventId)
    .map((item) => (item.weight ? `${item.eventId}:${item.weight}` : item.eventId))
    .join(',')
}

export function writeCellValue(raw: string): string | number | { formula: string } | undefined {
  if (raw === '') return undefined
  if (raw.startsWith('=')) return { formula: raw.slice(1) }
  if (/^-?\d+$/.test(raw)) return Number(raw)
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw)
  return raw
}

export function asEventType(value: string): 1 | 2 | 3 | 4 {
  const n = Number(value)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return 2
}

export function asFeedbackType(value: string): 1 | 2 | 3 {
  const n = Number(value)
  if (n === 1 || n === 2 || n === 3) return n
  return 1
}