import type { Choice, FeedbackNode, ResultRow, WalkEvent, WalkResource } from './types'

export function blankEvent(id = ''): WalkEvent {
  return {
    id,
    location: '',
    routeSlot: '',
    unlockState: '',
    drawCondition: '',
    weight: '',
    eventType: 2,
    title: '',
    optionIds: [],
    feedbackId: '',
    resultId: '',
    mark: '',
    note: '',
    resource: ''
  }
}

export function blankChoice(id = ''): Choice {
  return { id, text: '', enableCondition: '', resultIds: [] }
}

export function blankResult(id = '', text = ''): ResultRow {
  return {
    id,
    text,
    condition: '',
    priority: '',
    stamina: '',
    clean: '',
    mood: '',
    coin: '',
    addPool: '',
    forceNext: '',
    dropPickup: '',
    dropPos: '',
    unlockEvent: '',
    unlockPhoto: '',
    gainItem: '',
    deductItem: '',
    teamTag: '',
    adjustWeight: '',
    resource: '',
    petAction: '',
    hideRes: '',
    petMove: ''
  }
}

export function blankFeedback(id = '', feedbackId = '', nodeId = ''): FeedbackNode {
  return {
    id,
    feedbackId,
    parentId: '0',
    nodeId,
    nextIds: [],
    nextZero: true,
    priority: '',
    condition: '',
    nodeType: 1,
    text: '',
    showItem: '',
    optionIds: [],
    resultId: ''
  }
}

export function blankResource(id = ''): WalkResource {
  return { id, type: '8', filename: '', filetype: '1' }
}
