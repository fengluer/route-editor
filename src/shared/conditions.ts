export type ConditionAtom =
  | { kind: 'code'; code: string }
  | { kind: 'typed'; type: string; value: string }
  | { kind: 'raw'; text: string }

export const CODE_LABELS: Record<string, string> = {
  '6': '条件6',
  '7': '条件7',
  '10': '单宠',
  '11': '多宠'
}

export const TYPE_LABELS: Record<string, string> = {
  '3': '类型3',
  '4': '持有道具',
  '13': '类型13'
}

export function parseCondition(raw: string): ConditionAtom[] {
  const text = raw.trim()
  if (!text || text === '-') return []
  return text
    .split('&')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (CODE_LABELS[part]) return { kind: 'code', code: part } satisfies ConditionAtom
      const colon = part.indexOf(':')
      if (colon > 0) {
        const type = part.slice(0, colon)
        const value = part.slice(colon + 1)
        if (TYPE_LABELS[type] || /^\d+$/.test(type)) {
          return { kind: 'typed', type, value } satisfies ConditionAtom
        }
      }
      return { kind: 'raw', text: part } satisfies ConditionAtom
    })
}

export function serializeCondition(atoms: ConditionAtom[]): string {
  return atoms
    .map((atom) => {
      if (atom.kind === 'code') return atom.code
      if (atom.kind === 'typed') return atom.value ? `${atom.type}:${atom.value}` : atom.type
      return atom.text.trim()
    })
    .filter(Boolean)
    .join('&')
}