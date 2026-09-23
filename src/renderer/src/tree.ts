import type { Edge, Node } from '@xyflow/react'
import type { EditorDocument, EventType, PreviewMap } from '../../shared/types'
import { EVENT_TYPES } from '../../shared/types'
import { parseKeyed, parsePool, splitIds } from '../../shared/ids'
import type { Issue } from './validation'

export type FlowData = {
  kind: 'event' | 'option' | 'result' | 'feedback' | 'follow'
  title: string
  subtitle?: string
  error?: boolean
  entityId: string
  followKind?: 'pool' | 'force' | 'unlock' | 'weight'
  eventType?: EventType
  resultId?: string
  images?: { url: string; label: string }[]
  [key: string]: unknown
}

function resourceImages(raw: string, doc: EditorDocument, images: PreviewMap): { url: string; label: string }[] {
  const out: { url: string; label: string }[] = []
  const seen = new Set<string>()
  for (const item of parseKeyed(raw)) {
    if (!item.id || seen.has(item.id)) continue
    const url = images[item.id]
    if (!url) continue
    seen.add(item.id)
    const resource = doc.resources.find((row) => row.id === item.id)
    out.push({ url, label: resource ? `${resource.id} ${resource.filename}` : item.id })
  }
  return out
}

function hasError(issues: Issue[], nodeId: string): boolean {
  return issues.some((issue) => issue.nodeId === nodeId && issue.level === 'error')
}

export function buildEventGraph(
  doc: EditorDocument,
  eventId: string,
  issues: Issue[],
  images: PreviewMap = {}
): { nodes: Node<FlowData>[]; edges: Edge[] } {
  const event = doc.events.find((item) => item.id === eventId)
  const nodes: Node<FlowData>[] = []
  const edges: Edge[] = []
  if (!event) return { nodes, edges }

  const addNode = (node: Node<FlowData>): void => {
    if (!nodes.some((item) => item.id === node.id)) nodes.push(node)
  }
  const addEdge = (source: string, target: string, label?: string): void => {
    const id = `${source}->${target}`
    const existing = edges.find((item) => item.id === id)
    if (existing) {
      if (!existing.label && label) existing.label = label
      return
    }
    edges.push({ id, source, target, label, animated: Boolean(label) })
  }

  const eventNodeId = `event:${event.id}`
  addNode({
    id: eventNodeId,
    type: 'event',
    position: { x: 0, y: 0 },
    data: {
      kind: 'event',
      title: event.title && event.title !== '-' ? event.title : `${EVENT_TYPES[event.eventType]} #${event.id}`,
      eventType: event.eventType,
      subtitle: [
        event.mark === '1' ? '照片' : '',
        event.routeSlot ? `路线 ${event.routeSlot}` : '',
        event.resource ? '前素材' : ''
      ]
        .filter(Boolean)
        .join(' · '),
      error: hasError(issues, eventNodeId),
      entityId: event.id,
      images: resourceImages(event.resource, doc, images)
    }
  })

  const attachResult = (parentId: string, resultId: string): void => {
    const result = doc.results.find((item) => item.id === resultId)
    const resultNodeId = `result:${resultId}`
    addNode({
      id: resultNodeId,
      type: 'result',
      position: { x: 0, y: 0 },
      data: {
        kind: 'result',
        title: result?.text || `结果 ${resultId}`,
        subtitle: [
          result?.stamina && `体力${result.stamina}`,
          result?.mood && `心情${result.mood}`,
          result?.dropPickup && '掉落',
          result?.resource && '后素材',
          result?.petAction && '动作',
          result?.petMove && `位移${result.petMove}`
        ]
          .filter(Boolean)
          .join(' · '),
        error: hasError(issues, resultNodeId),
        entityId: resultId,
        images: resourceImages(result?.resource ?? '', doc, images)
      }
    })
    addEdge(parentId, resultNodeId)
    if (!result) return
    for (const item of parsePool(result.addPool)) {
      const followId = `follow:${result.id}:pool:${item.eventId}`
      const target = doc.events.find((row) => row.id === item.eventId)
      addNode({
        id: followId,
        type: 'follow',
        position: { x: 0, y: 0 },
        data: {
          kind: 'follow',
          title: `加池 ${item.eventId}`,
          subtitle: `${target?.title || '未知事件'} · w${item.weight || '?'}`,
          followKind: 'pool',
          eventType: target?.eventType,
          entityId: item.eventId,
          resultId: result.id,
          error: hasError(issues, resultNodeId)
        }
      })
      addEdge(resultNodeId, followId, '加池')
    }
    for (const id of splitIds(result.forceNext)) {
      const followId = `follow:${result.id}:force:${id}`
      const target = doc.events.find((row) => row.id === id)
      addNode({
        id: followId,
        type: 'follow',
        position: { x: 0, y: 0 },
        data: {
          kind: 'follow',
          title: `强制 ${id}`,
          subtitle: target?.title || '未知事件',
          followKind: 'force',
          eventType: target?.eventType,
          entityId: id,
          resultId: result.id
        }
      })
      addEdge(resultNodeId, followId, '强制')
    }
    for (const id of splitIds(result.unlockEvent)) {
      const followId = `follow:${result.id}:unlock:${id}`
      const target = doc.events.find((row) => row.id === id)
      addNode({
        id: followId,
        type: 'follow',
        position: { x: 0, y: 0 },
        data: {
          kind: 'follow',
          title: `解锁 ${id}`,
          subtitle: target?.title || '未知事件',
          followKind: 'unlock',
          eventType: target?.eventType,
          entityId: id,
          resultId: result.id
        }
      })
      addEdge(resultNodeId, followId, '解锁')
    }
    for (const item of parsePool(result.adjustWeight)) {
      const followId = `follow:${result.id}:weight:${item.eventId}`
      addNode({
        id: followId,
        type: 'follow',
        position: { x: 0, y: 0 },
        data: {
          kind: 'follow',
          title: `改权重 ${item.eventId}`,
          subtitle: item.weight,
          followKind: 'weight',
          eventType: doc.events.find((row) => row.id === item.eventId)?.eventType,
          entityId: item.eventId,
          resultId: result.id
        }
      })
      addEdge(resultNodeId, followId, '权重')
    }
  }

  const attachOption = (parentId: string, optionId: string): void => {
    const choice = doc.choices.find((item) => item.id === optionId)
    const optionNodeId = `option:${optionId}`
    addNode({
      id: optionNodeId,
      type: 'option',
      position: { x: 0, y: 0 },
      data: {
        kind: 'option',
        title: choice?.text || `选项 ${optionId}`,
        subtitle: choice?.enableCondition ? `条件 ${choice.enableCondition}` : undefined,
        error: hasError(issues, optionNodeId),
        entityId: optionId
      }
    })
    addEdge(parentId, optionNodeId)
    for (const resultId of choice?.resultIds ?? []) attachResult(optionNodeId, resultId)
  }

  for (const optionId of event.optionIds) attachOption(eventNodeId, optionId)
  if (event.resultId) attachResult(eventNodeId, event.resultId)

  if (event.feedbackId) {
    const graph = doc.feedbackNodes.filter((item) => item.feedbackId === event.feedbackId)
    for (const node of graph) {
      const fbId = `fb:${node.nodeId}`
      const typeLabel = node.nodeType === 2 ? '选项节点' : node.nodeType === 3 ? '文字+道具' : '对话'
      addNode({
        id: fbId,
        type: 'feedback',
        position: { x: 0, y: 0 },
        data: {
          kind: 'feedback',
          title: node.text || typeLabel,
          subtitle: [node.condition && `条件 ${node.condition}`, typeLabel].filter(Boolean).join(' · '),
          error: hasError(issues, fbId),
          entityId: node.nodeId
        }
      })
    }
    const ids = new Set(graph.map((item) => item.nodeId))
    const roots = graph.filter((item) => !item.parentId || item.parentId === '0' || !ids.has(item.parentId))
    for (const root of roots) addEdge(eventNodeId, `fb:${root.nodeId}`, root.condition || undefined)
    for (const node of graph) {
      const fbId = `fb:${node.nodeId}`
      if (node.parentId && node.parentId !== '0' && ids.has(node.parentId)) {
        addEdge(`fb:${node.parentId}`, fbId, node.condition || undefined)
      }
      for (const nextId of node.nextIds) {
        if (ids.has(nextId)) addEdge(fbId, `fb:${nextId}`)
      }
      for (const optionId of node.optionIds) attachOption(fbId, optionId)
      if (node.resultId) attachResult(fbId, node.resultId)
    }
  }

  return { nodes, edges }
}