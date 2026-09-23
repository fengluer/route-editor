import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Choice, EditorDocument, FeedbackNode, PreviewMap, ResultRow, WalkEvent, WalkResource } from '../../shared/types'
import { blankFeedback, blankResource, blankResult } from '../../shared/blank'
import { formatPool, nextNumericId, parsePool } from '../../shared/ids'
import { createTemplate } from './templates'

export type SelectedNode =
  | { kind: 'event'; id: string }
  | { kind: 'option'; id: string }
  | { kind: 'result'; id: string }
  | { kind: 'feedback'; id: string }
  | { kind: 'follow'; resultId: string; followKind: 'pool' | 'force' | 'unlock' | 'weight'; eventId: string }
  | { kind: 'resource'; id: string }

export interface AppState {
  doc: EditorDocument
  path: string | null
  dirty: boolean
  images: PreviewMap
  selectedEventId: string | null
  selected: SelectedNode | null
  layoutNonce: number
  load: (doc: EditorDocument, path: string | null) => void
  setImages: (images: PreviewMap) => void
  markSaved: (path: string) => void
  selectEvent: (id: string | null) => void
  selectNode: (node: SelectedNode | null) => void
  bumpLayout: () => void
  patchEvent: (id: string, patch: Partial<WalkEvent>) => void
  patchChoice: (id: string, patch: Partial<Choice>) => void
  patchResult: (id: string, patch: Partial<ResultRow>) => void
  patchFeedback: (id: string, patch: Partial<FeedbackNode>) => void
  patchResource: (id: string, patch: Partial<WalkResource>) => void
  addResource: () => void
  addOption: (eventId: string) => void
  addResultToOption: (optionId: string) => void
  addFeedbackChild: (eventId: string, parentNodeId: string | null, nodeType: 1 | 2 | 3) => void
  addFollow: (resultId: string, followKind: 'pool' | 'force' | 'unlock' | 'weight', eventId: string) => void
  addOptionToFeedback: (nodeId: string) => void
  addResultToFeedback: (nodeId: string) => void
  createFromTemplate: (kind: 'guide' | 'decision' | 'feedback' | 'plot') => void
  deleteSelected: () => void
}

const emptyDoc = (): EditorDocument => ({
  events: [],
  choices: [],
  results: [],
  feedbackNodes: [],
  resources: [],
  resourceTypes: [],
  routes: []
})

function newResult(doc: EditorDocument, text = '新结果'): ResultRow {
  return { ...blankResult(nextNumericId(doc.results.map((item) => item.id)), text), priority: '1' }
}

function newChoice(doc: EditorDocument, resultId: string): Choice {
  return {
    id: nextNumericId(doc.choices.map((item) => item.id)),
    text: '新选项',
    enableCondition: '',
    resultIds: [resultId]
  }
}

export const useDocStore = create<AppState>()(
  temporal(
    (set, get) => ({
      doc: emptyDoc(),
      path: null,
      dirty: false,
      images: {},
      selectedEventId: null,
      selected: null,
      layoutNonce: 0,
      load: (doc, path) =>
        set({
          doc,
          path,
          dirty: false,
          images: {},
          selectedEventId: doc.events[0]?.id ?? null,
          selected: doc.events[0] ? { kind: 'event', id: doc.events[0].id } : null,
          layoutNonce: get().layoutNonce + 1
        }),
      markSaved: (path) => set({ path, dirty: false }),
      setImages: (images) => set({ images }),
      selectEvent: (id) =>
        set({
          selectedEventId: id,
          selected: id ? { kind: 'event', id } : null,
          layoutNonce: get().layoutNonce + 1
        }),
      selectNode: (node) => set({ selected: node }),
      bumpLayout: () => set({ layoutNonce: get().layoutNonce + 1 }),
      patchEvent: (id, patch) =>
        set({
          dirty: true,
          doc: {
            ...get().doc,
            events: get().doc.events.map((item) => (item.id === id ? { ...item, ...patch } : item))
          }
        }),
      patchChoice: (id, patch) =>
        set({
          dirty: true,
          doc: {
            ...get().doc,
            choices: get().doc.choices.map((item) => (item.id === id ? { ...item, ...patch } : item))
          }
        }),
      patchResult: (id, patch) =>
        set({
          dirty: true,
          doc: {
            ...get().doc,
            results: get().doc.results.map((item) => (item.id === id ? { ...item, ...patch } : item))
          }
        }),
      patchFeedback: (id, patch) =>
        set({
          dirty: true,
          doc: {
            ...get().doc,
            feedbackNodes: get().doc.feedbackNodes.map((item) =>
              item.nodeId === id ? { ...item, ...patch } : item
            )
          }
        }),
      patchResource: (id, patch) =>
        set({
          dirty: true,
          doc: {
            ...get().doc,
            resources: get().doc.resources.map((item) => (item.id === id ? { ...item, ...patch } : item))
          }
        }),
      addResource: () => {
        const doc = get().doc
        const resource = blankResource(nextNumericId(doc.resources.map((item) => item.id)))
        resource.filename = 'New_res'
        set({
          dirty: true,
          selected: { kind: 'resource', id: resource.id },
          doc: { ...doc, resources: [...doc.resources, resource] }
        })
      },
      addOption: (eventId) => {
        const doc = get().doc
        const result = newResult(doc)
        const choice = newChoice({ ...doc, results: [...doc.results, result] }, result.id)
        set({
          dirty: true,
          selected: { kind: 'option', id: choice.id },
          doc: {
            ...doc,
            events: doc.events.map((item) =>
              item.id === eventId ? { ...item, optionIds: [...item.optionIds, choice.id] } : item
            ),
            choices: [...doc.choices, choice],
            results: [...doc.results, result]
          },
          layoutNonce: get().layoutNonce + 1
        })
      },
      addResultToOption: (optionId) => {
        const doc = get().doc
        const result = newResult(doc)
        set({
          dirty: true,
          selected: { kind: 'result', id: result.id },
          doc: {
            ...doc,
            choices: doc.choices.map((item) =>
              item.id === optionId ? { ...item, resultIds: [...item.resultIds, result.id] } : item
            ),
            results: [...doc.results, result]
          },
          layoutNonce: get().layoutNonce + 1
        })
      },
      addFeedbackChild: (eventId, parentNodeId, nodeType) => {
        const doc = get().doc
        const event = doc.events.find((item) => item.id === eventId)
        if (!event) return
        let feedbackId = event.feedbackId
        let events = doc.events
        if (!feedbackId) {
          feedbackId = nextNumericId(doc.feedbackNodes.map((item) => item.feedbackId))
          events = events.map((item) => (item.id === eventId ? { ...item, feedbackId, eventType: 3 } : item))
        }
        const nodeId = nextNumericId(doc.feedbackNodes.map((item) => item.nodeId))
        const rowId = nextNumericId(doc.feedbackNodes.map((item) => item.id))
        const node: FeedbackNode = {
          ...blankFeedback(rowId, feedbackId, nodeId),
          parentId: parentNodeId ?? '0',
          nodeType,
          text: nodeType === 2 ? '' : '新对话'
        }
        const feedbackNodes = doc.feedbackNodes.map((item) => {
          if (parentNodeId && item.nodeId === parentNodeId && item.feedbackId === feedbackId) {
            return { ...item, nextIds: [...item.nextIds, nodeId], nextZero: false }
          }
          return item
        })
        feedbackNodes.push(node)
        set({
          dirty: true,
          selected: { kind: 'feedback', id: nodeId },
          doc: { ...doc, events, feedbackNodes },
          layoutNonce: get().layoutNonce + 1
        })
      },
      addFollow: (resultId, followKind, eventId) => {
        const doc = get().doc
        set({
          dirty: true,
          doc: {
            ...doc,
            results: doc.results.map((item) => {
              if (item.id !== resultId) return item
              if (followKind === 'pool') {
                return { ...item, addPool: formatPool([...parsePool(item.addPool), { eventId, weight: '300' }]) }
              }
              if (followKind === 'force') return { ...item, forceNext: eventId }
              if (followKind === 'unlock') return { ...item, unlockEvent: eventId }
              return { ...item, adjustWeight: formatPool([...parsePool(item.adjustWeight), { eventId, weight: '100' }]) }
            })
          },
          layoutNonce: get().layoutNonce + 1
        })
      },
      addOptionToFeedback: (nodeId) => {
        const doc = get().doc
        const result = newResult(doc)
        const choice = newChoice({ ...doc, results: [...doc.results, result] }, result.id)
        set({
          dirty: true,
          selected: { kind: 'option', id: choice.id },
          doc: {
            ...doc,
            choices: [...doc.choices, choice],
            results: [...doc.results, result],
            feedbackNodes: doc.feedbackNodes.map((item) =>
              item.nodeId === nodeId
                ? { ...item, nodeType: 2, optionIds: [...item.optionIds, choice.id], nextZero: true, nextIds: [] }
                : item
            )
          },
          layoutNonce: get().layoutNonce + 1
        })
      },
      addResultToFeedback: (nodeId) => {
        const doc = get().doc
        const result = newResult(doc)
        set({
          dirty: true,
          selected: { kind: 'result', id: result.id },
          doc: {
            ...doc,
            results: [...doc.results, result],
            feedbackNodes: doc.feedbackNodes.map((item) =>
              item.nodeId === nodeId ? { ...item, resultId: result.id, nextZero: true, nextIds: [] } : item
            )
          },
          layoutNonce: get().layoutNonce + 1
        })
      },
      createFromTemplate: (kind) => {
        const created = createTemplate(get().doc, kind)
        set({
          doc: created.doc,
          dirty: true,
          selectedEventId: created.eventId,
          selected: { kind: 'event', id: created.eventId },
          layoutNonce: get().layoutNonce + 1
        })
      },
      deleteSelected: () => {
        const { selected, doc, selectedEventId } = get()
        if (!selected) return
        let next = doc
        if (selected.kind === 'option') {
          next = {
            ...doc,
            events: doc.events.map((item) => ({
              ...item,
              optionIds: item.optionIds.filter((id) => id !== selected.id)
            })),
            feedbackNodes: doc.feedbackNodes.map((item) => ({
              ...item,
              optionIds: item.optionIds.filter((id) => id !== selected.id)
            })),
            choices: doc.choices.filter((item) => item.id !== selected.id)
          }
        } else if (selected.kind === 'result') {
          next = {
            ...doc,
            events: doc.events.map((item) => ({
              ...item,
              resultId: item.resultId === selected.id ? '' : item.resultId
            })),
            choices: doc.choices.map((item) => ({
              ...item,
              resultIds: item.resultIds.filter((id) => id !== selected.id)
            })),
            feedbackNodes: doc.feedbackNodes.map((item) => ({
              ...item,
              resultId: item.resultId === selected.id ? '' : item.resultId
            })),
            results: doc.results.filter((item) => item.id !== selected.id)
          }
        } else if (selected.kind === 'feedback') {
          next = {
            ...doc,
            feedbackNodes: doc.feedbackNodes
              .filter((item) => item.nodeId !== selected.id)
              .map((item) => {
                const nextIds = item.nextIds.filter((id) => id !== selected.id)
                return {
                  ...item,
                  nextIds,
                  nextZero: nextIds.length === 0 ? true : item.nextZero,
                  parentId: item.parentId === selected.id ? '0' : item.parentId
                }
              })
          }
        } else if (selected.kind === 'follow') {
          next = {
            ...doc,
            results: doc.results.map((item) => {
              if (item.id !== selected.resultId) return item
              if (selected.followKind === 'pool') {
                return {
                  ...item,
                  addPool: formatPool(parsePool(item.addPool).filter((row) => row.eventId !== selected.eventId))
                }
              }
              if (selected.followKind === 'force') return { ...item, forceNext: '' }
              if (selected.followKind === 'unlock') return { ...item, unlockEvent: '' }
              return {
                ...item,
                adjustWeight: formatPool(parsePool(item.adjustWeight).filter((row) => row.eventId !== selected.eventId))
              }
            })
          }
        } else if (selected.kind === 'resource') {
          next = {
            ...doc,
            resources: doc.resources.filter((item) => item.id !== selected.id)
          }
        } else if (selected.kind === 'event') {
          next = {
            ...doc,
            events: doc.events.filter((item) => item.id !== selected.id)
          }
        }
        const still = next.events.some((item) => item.id === selectedEventId)
        set({
          doc: next,
          dirty: true,
          selected: still && selectedEventId ? { kind: 'event', id: selectedEventId } : next.events[0]
            ? { kind: 'event', id: next.events[0].id }
            : null,
          selectedEventId: still ? selectedEventId : next.events[0]?.id ?? null,
          layoutNonce: get().layoutNonce + 1
        })
      }
    }),
    {
      limit: 80,
      partialize: (state) => ({ doc: state.doc })
    }
  )
)