import { EVENT_TYPES, type EditorDocument, type EventType, type WalkEvent, type WalkRoute } from '../../shared/types'
import { parsePool, parseRouteSlot, splitIds } from '../../shared/ids'

export interface StoryEvent {
  id: string
  title: string
  eventType: EventType
  via?: string
}

export interface StoryStep {
  position: number
  expectedType: EventType | null
  events: StoryEvent[]
  fromFollow: boolean
}

export interface StorylineModel {
  routeId: string
  position: string
  route: WalkRoute | null
  steps: StoryStep[]
}

const VIA_LABEL = {
  pool: '加池',
  force: '强制',
  unlock: '解锁',
  weight: '改权重'
} as const

type ViaKind = keyof typeof VIA_LABEL

function expectedTypeAt(route: WalkRoute | null, position: number): EventType | null {
  if (!route) return null
  const raw = route.rhythm.split(/[,，]/)[position - 1]?.trim()
  if (raw === '1' || raw === '2' || raw === '3' || raw === '4') return Number(raw) as EventType
  return null
}

export function eventTitle(event: { id: string; title: string; eventType: EventType }): string {
  if (event.title && event.title !== '-') return event.title
  return `${EVENT_TYPES[event.eventType]} #${event.id}`
}

function resultIdsOf(doc: EditorDocument, event: WalkEvent): string[] {
  const ids = event.resultId ? [event.resultId] : []
  const choiceIds = new Set(event.optionIds)
  if (event.feedbackId) {
    for (const node of doc.feedbackNodes) {
      if (node.feedbackId !== event.feedbackId) continue
      if (node.resultId) ids.push(node.resultId)
      for (const optionId of node.optionIds) choiceIds.add(optionId)
    }
  }
  for (const optionId of choiceIds) {
    const choice = doc.choices.find((item) => item.id === optionId)
    if (choice) ids.push(...choice.resultIds)
  }
  return [...new Set(ids)]
}

function followsOf(doc: EditorDocument, eventId: string): { id: string; via: ViaKind }[] {
  const event = doc.events.find((item) => item.id === eventId)
  if (!event) return []
  const out: { id: string; via: ViaKind }[] = []
  for (const resultId of resultIdsOf(doc, event)) {
    const result = doc.results.find((item) => item.id === resultId)
    if (!result) continue
    for (const item of parsePool(result.addPool)) out.push({ id: item.eventId, via: 'pool' })
    for (const id of splitIds(result.forceNext)) out.push({ id, via: 'force' })
    for (const id of splitIds(result.unlockEvent)) out.push({ id, via: 'unlock' })
    for (const item of parsePool(result.adjustWeight)) out.push({ id: item.eventId, via: 'weight' })
  }
  return out.filter((item) => item.id)
}

function toStoryEvent(event: WalkEvent, via?: string): StoryEvent {
  return {
    id: event.id,
    title: eventTitle(event),
    eventType: event.eventType,
    via
  }
}

function chainFrom(doc: EditorDocument, start: WalkEvent, route: WalkRoute | null): StoryStep[] {
  const slot = parseRouteSlot(start.routeSlot)
  const startPos = Math.max(1, Number(slot?.position) || 1)
  const count = Number(route?.count)
  const total = Math.max(Number.isFinite(count) && count > 0 ? count : 0, startPos)
  const steps: StoryStep[] = []
  for (let position = 1; position <= total; position++) {
    steps.push({
      position,
      expectedType: expectedTypeAt(route, position),
      events: [],
      fromFollow: position > startPos
    })
  }

  const seen = new Set<string>([start.id])
  steps[startPos - 1].events.push(toStoryEvent(start))
  let layer = [start.id]
  let position = startPos
  while (layer.length) {
    const next = new Map<string, Set<ViaKind>>()
    for (const id of layer) {
      for (const follow of followsOf(doc, id)) {
        if (seen.has(follow.id)) continue
        const vias = next.get(follow.id) ?? new Set<ViaKind>()
        vias.add(follow.via)
        next.set(follow.id, vias)
      }
    }
    if (!next.size) break
    position += 1
    while (steps.length < position) {
      steps.push({
        position: steps.length + 1,
        expectedType: expectedTypeAt(route, steps.length + 1),
        events: [],
        fromFollow: true
      })
    }
    const ids: string[] = []
    for (const [id, vias] of next) {
      seen.add(id)
      ids.push(id)
      const event = doc.events.find((item) => item.id === id)
      if (!event) {
        steps[position - 1].events.push({ id, title: `事件 #${id}`, eventType: 2, via: [...vias].map((via) => VIA_LABEL[via]).join(' / ') })
        continue
      }
      steps[position - 1].events.push(toStoryEvent(event, [...vias].map((via) => VIA_LABEL[via]).join(' / ')))
    }
    steps[position - 1].fromFollow = true
    layer = ids
  }
  return steps
}

function reaches(doc: EditorDocument, startId: string, targetId: string): boolean {
  if (startId === targetId) return true
  const seen = new Set<string>([startId])
  let layer = [startId]
  while (layer.length) {
    const next: string[] = []
    for (const id of layer) {
      for (const follow of followsOf(doc, id)) {
        if (seen.has(follow.id)) continue
        if (follow.id === targetId) return true
        seen.add(follow.id)
        next.push(follow.id)
      }
    }
    layer = next
  }
  return false
}

export function buildStoryline(doc: EditorDocument, eventId: string | null): StorylineModel | null {
  if (!eventId) return null
  const selected = doc.events.find((item) => item.id === eventId)
  if (!selected) return null

  let start = parseRouteSlot(selected.routeSlot) ? selected : null
  if (!start) {
    start = doc.events.find((event) => parseRouteSlot(event.routeSlot) && reaches(doc, event.id, selected.id)) ?? null
  }
  if (!start) return null

  const slot = parseRouteSlot(start.routeSlot)
  if (!slot) return null
  const route = doc.routes.find((item) => item.id === slot.routeId) ?? null
  return {
    routeId: slot.routeId,
    position: slot.position,
    route,
    steps: chainFrom(doc, start, route)
  }
}
