import { EVENT_TYPES, type EditorDocument, type EventType } from '../../shared/types'
import { parseKeyed, parsePool, parseRouteSlot, splitIds } from '../../shared/ids'

export interface Issue {
  level: 'error' | 'warning'
  eventId?: string
  nodeId?: string
  message: string
}

export function validateDoc(doc: EditorDocument): Issue[] {
  const issues: Issue[] = []
  const eventIds = new Set(doc.events.map((item) => item.id))
  const choiceIds = new Set(doc.choices.map((item) => item.id))
  const resultIds = new Set(doc.results.map((item) => item.id))
  const feedbackIds = new Set(doc.feedbackNodes.map((item) => item.feedbackId))
  const fbNodeIds = new Set(doc.feedbackNodes.map((item) => item.nodeId))
  const resourceIds = new Set(doc.resources.map((item) => item.id))

  const checkResource = (eventId: string | undefined, nodeId: string, label: string, raw: string): void => {
    for (const item of parseKeyed(raw)) {
      if (item.id && !resourceIds.has(item.id)) {
        issues.push({ level: 'error', eventId, nodeId, message: `${label} 素材 ${item.id} 不存在` })
      }
    }
  }

  const eventByChoice = new Map<string, string>()
  for (const event of doc.events) {
    for (const id of event.optionIds) eventByChoice.set(id, event.id)
    if ((event.eventType === 1 || event.eventType === 2) && event.optionIds.length === 0) {
      issues.push({ level: 'error', eventId: event.id, nodeId: `event:${event.id}`, message: '路牌/抉择没有选项' })
    }
    if (event.eventType === 3 && !event.feedbackId) {
      issues.push({ level: 'error', eventId: event.id, nodeId: `event:${event.id}`, message: '反馈事件没有反馈内容' })
    }
    if (event.eventType === 3 && event.feedbackId && !feedbackIds.has(event.feedbackId)) {
      issues.push({ level: 'error', eventId: event.id, nodeId: `event:${event.id}`, message: `反馈内容 ${event.feedbackId} 不存在` })
    }
    if (event.eventType === 4 && !event.resultId) {
      issues.push({ level: 'error', eventId: event.id, nodeId: `event:${event.id}`, message: '剧情事件没有结果' })
    }
    if (event.resultId && !resultIds.has(event.resultId)) {
      issues.push({ level: 'error', eventId: event.id, nodeId: `event:${event.id}`, message: `结果 ${event.resultId} 不存在` })
    }
    checkResource(event.id, `event:${event.id}`, '事件前素材', event.resource)
    const slot = parseRouteSlot(event.routeSlot)
    if (event.routeSlot && !slot) {
      issues.push({ level: 'warning', eventId: event.id, nodeId: `event:${event.id}`, message: '路线位置格式应为 路线ID:位置' })
    }
    if (slot && doc.routes.length) {
      const route = doc.routes.find((item) => item.id === slot.routeId)
      if (!route) {
        issues.push({ level: 'error', eventId: event.id, nodeId: `event:${event.id}`, message: `路线 ${slot.routeId} 不在基础路线表` })
      } else {
        const count = Number(route.count)
        const position = Number(slot.position)
        if (!Number.isInteger(position) || position < 1 || (Number.isFinite(count) && count > 0 && position > count)) {
          issues.push({ level: 'error', eventId: event.id, nodeId: `event:${event.id}`, message: `路线 ${route.id} 没有位置 ${slot.position}` })
        }
        const expected = route.rhythm.split(/[,，]/)[position - 1]?.trim()
        if (expected && /^[1-4]$/.test(expected) && expected !== String(event.eventType)) {
          const expectedType = Number(expected) as EventType
          issues.push({
            level: 'warning',
            eventId: event.id,
            nodeId: `event:${event.id}`,
            message: `位置 ${slot.position} 的路线节奏是${EVENT_TYPES[expectedType]}，当前事件是${EVENT_TYPES[event.eventType]}`
          })
        }
      }
    }
    for (const optionId of event.optionIds) {
      if (optionId === '.') {
        issues.push({ level: 'error', eventId: event.id, nodeId: `event:${event.id}`, message: '选项ID非法: .' })
        continue
      }
      if (!choiceIds.has(optionId)) {
        issues.push({ level: 'error', eventId: event.id, nodeId: `event:${event.id}`, message: `选项 ${optionId} 不存在` })
      }
    }
  }

  for (const choice of doc.choices) {
    const eventId = eventByChoice.get(choice.id)
    if (choice.id === '.') {
      issues.push({ level: 'error', eventId, nodeId: `option:${choice.id}`, message: '选项ID非法: .' })
    }
    if (choice.resultIds.length === 0) {
      issues.push({ level: 'error', eventId, nodeId: `option:${choice.id}`, message: `选项「${choice.text || choice.id}」没有结果` })
    }
    for (const resultId of choice.resultIds) {
      if (!resultIds.has(resultId)) {
        issues.push({ level: 'error', eventId, nodeId: `option:${choice.id}`, message: `结果 ${resultId} 不存在` })
      }
    }
  }

  const pushEventRef = (eventId: string | undefined, nodeId: string, label: string, raw: string): void => {
    for (const id of splitIds(raw)) {
      if (id && !eventIds.has(id)) {
        issues.push({ level: 'error', eventId, nodeId, message: `${label} 指向不存在的事件 ${id}` })
      }
    }
  }

  for (const result of doc.results) {
    const nodeId = `result:${result.id}`
    for (const item of parsePool(result.addPool)) pushEventRef(undefined, nodeId, '加池', item.eventId)
    pushEventRef(undefined, nodeId, '强制下一环', result.forceNext)
    pushEventRef(undefined, nodeId, '解锁事件', result.unlockEvent)
    for (const item of parsePool(result.adjustWeight)) pushEventRef(undefined, nodeId, '改权重', item.eventId)
    checkResource(undefined, nodeId, '事件后素材', result.resource)
    for (const id of splitIds(result.hideRes)) {
      if (id && !resourceIds.has(id)) {
        issues.push({ level: 'error', nodeId, message: `隐藏素材 ${id} 不存在` })
      }
    }
  }

  for (const node of doc.feedbackNodes) {
    const owner = doc.events.find((item) => item.feedbackId === node.feedbackId)?.id
    const nodeId = `fb:${node.nodeId}`
    const groupIds = new Set(doc.feedbackNodes.filter((item) => item.feedbackId === node.feedbackId).map((item) => item.nodeId))
    if (node.parentId && node.parentId !== '0' && !groupIds.has(node.parentId)) {
      issues.push({ level: 'error', eventId: owner, nodeId, message: `父节点 ${node.parentId} 不存在` })
    }
    for (const nextId of node.nextIds) {
      if (!fbNodeIds.has(nextId)) {
        issues.push({ level: 'error', eventId: owner, nodeId, message: `next节点 ${nextId} 不存在` })
      }
    }
    if (node.nodeType === 2 && node.optionIds.length === 0) {
      issues.push({ level: 'error', eventId: owner, nodeId, message: '对话选项节点没有选项' })
    }
    for (const optionId of node.optionIds) {
      if (!choiceIds.has(optionId)) {
        issues.push({ level: 'error', eventId: owner, nodeId, message: `选项 ${optionId} 不存在` })
      }
    }
    if (node.resultId && !resultIds.has(node.resultId)) {
      issues.push({ level: 'error', eventId: owner, nodeId, message: `结果 ${node.resultId} 不存在` })
    }
  }

  return issues
}

export function issuesForEvent(issues: Issue[], eventId: string): Issue[] {
  return issues.filter((issue) => issue.eventId === eventId)
}