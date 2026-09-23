export const EVENT_TYPES = {
  1: '路牌',
  2: '抉择',
  3: '反馈',
  4: '剧情'
} as const

export const FEEDBACK_NODE_TYPES = {
  1: '纯文字',
  2: '选项',
  3: '文字+道具'
} as const

export type EventType = 1 | 2 | 3 | 4
export type FeedbackNodeType = 1 | 2 | 3

export const FILE_TYPES = {
  1: '图片',
  2: '帧动画'
} as const

export interface WalkEvent {
  id: string
  location: string
  routeSlot: string
  unlockState: string
  drawCondition: string
  weight: string
  eventType: EventType
  title: string
  optionIds: string[]
  feedbackId: string
  resultId: string
  mark: string
  note: string
  resource: string
}

export interface Choice {
  id: string
  text: string
  enableCondition: string
  resultIds: string[]
}

export interface ResultRow {
  id: string
  text: string
  condition: string
  priority: string
  stamina: string
  clean: string
  mood: string
  coin: string
  addPool: string
  forceNext: string
  dropPickup: string
  dropPos: string
  unlockEvent: string
  unlockPhoto: string
  gainItem: string
  deductItem: string
  teamTag: string
  adjustWeight: string
  resource: string
  petAction: string
  hideRes: string
  petMove: string
}

export interface FeedbackNode {
  id: string
  feedbackId: string
  parentId: string
  nodeId: string
  nextIds: string[]
  nextZero: boolean
  priority: string
  condition: string
  nodeType: FeedbackNodeType
  text: string
  showItem: string
  optionIds: string[]
  resultId: string
}

export interface WalkResource {
  id: string
  type: string
  filename: string
  filetype: string
}

export interface WalkRoute {
  id: string
  location: string
  count: string
  weight: string
  rhythm: string
  dropPos: string
}

export interface ResourceTypeInfo {
  id: string
  name: string
  layer: string
  form: string
  note: string
}

export interface EditorDocument {
  events: WalkEvent[]
  choices: Choice[]
  results: ResultRow[]
  feedbackNodes: FeedbackNode[]
  resources: WalkResource[]
  resourceTypes: ResourceTypeInfo[]
  routes: WalkRoute[]
}

export type MenuAction =
  | 'open'
  | 'save'
  | 'saveAs'
  | 'undo'
  | 'redo'
  | 'layout'
  | 'newGuide'
  | 'newDecision'
  | 'newFeedback'
  | 'newPlot'

export type FileResult =
  | { ok: true; path: string; doc: EditorDocument }
  | { ok: false; cancelled?: boolean; error?: string }

export type SaveResult =
  | { ok: true; path: string }
  | { ok: false; cancelled?: boolean; error?: string }

export type PreviewMap = Record<string, string>

export type PreviewPickResult =
  | { ok: true; images: PreviewMap }
  | { ok: false; cancelled?: boolean; error?: string }