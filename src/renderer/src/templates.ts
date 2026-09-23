import type { Choice, EditorDocument, FeedbackNode, ResultRow, WalkEvent } from '../../shared/types'
import { blankEvent, blankFeedback, blankResult } from '../../shared/blank'
import { nextNumericId } from '../../shared/ids'

function newResult(doc: EditorDocument, text: string): ResultRow {
  return { ...blankResult(nextNumericId(doc.results.map((item) => item.id)), text), priority: '1' }
}

function newChoice(doc: EditorDocument, text: string, resultId: string): Choice {
  return {
    id: nextNumericId(doc.choices.map((item) => item.id)),
    text,
    enableCondition: '',
    resultIds: [resultId]
  }
}

export function createTemplate(
  doc: EditorDocument,
  kind: 'guide' | 'decision' | 'feedback' | 'plot'
): { doc: EditorDocument; eventId: string } {
  const eventId = nextNumericId(doc.events.map((item) => item.id))
  const events = [...doc.events]
  const choices = [...doc.choices]
  const results = [...doc.results]
  const feedbackNodes = [...doc.feedbackNodes]

  const base: WalkEvent = {
    ...blankEvent(eventId),
    location: '1',
    weight: '100',
    mark: '0'
  }

  if (kind === 'guide' || kind === 'decision') {
    const leftResult = newResult({ ...doc, results }, kind === 'guide' ? '选了往左' : '选项一结果')
    results.push(leftResult)
    const rightResult = newResult({ ...doc, results }, kind === 'guide' ? '选了往右' : '选项二结果')
    results.push(rightResult)
    const left = newChoice({ ...doc, choices }, kind === 'guide' ? '往左' : '选项一', leftResult.id)
    choices.push(left)
    const right = newChoice({ ...doc, choices }, kind === 'guide' ? '往右' : '选项二', rightResult.id)
    choices.push(right)
    events.push({
      ...base,
      eventType: kind === 'guide' ? 1 : 2,
      title: kind === 'guide' ? '前面出现两条路' : '发生了一件事',
      optionIds: [left.id, right.id]
    })
  } else if (kind === 'plot') {
    const result = newResult({ ...doc, results }, '剧情结算')
    results.push(result)
    events.push({
      ...base,
      eventType: 4,
      title: '-',
      resultId: result.id
    })
  } else {
    const feedbackId = nextNumericId(feedbackNodes.map((item) => item.feedbackId))
    const rowBase = Number(nextNumericId(feedbackNodes.map((item) => item.id)))
    const nodeIdBase = Number(nextNumericId(feedbackNodes.map((item) => item.nodeId)))
    const result = newResult({ ...doc, results }, '反馈结果')
    results.push(result)
    const choice = newChoice({ ...doc, choices }, '好的', result.id)
    choices.push(choice)
    const n1: FeedbackNode = {
      ...blankFeedback(String(rowBase), feedbackId, String(nodeIdBase)),
      nextIds: [String(nodeIdBase + 1)],
      nextZero: false,
      text: '发生了什么…'
    }
    const n2: FeedbackNode = {
      ...n1,
      id: String(rowBase + 1),
      parentId: n1.nodeId,
      nodeId: String(nodeIdBase + 1),
      nextIds: [String(nodeIdBase + 2)],
      text: '要怎么做？'
    }
    const n3: FeedbackNode = {
      ...n1,
      id: String(rowBase + 2),
      parentId: n2.nodeId,
      nodeId: String(nodeIdBase + 2),
      nextIds: [],
      nextZero: true,
      nodeType: 2,
      text: '',
      optionIds: [choice.id]
    }
    feedbackNodes.push(n1, n2, n3)
    events.push({
      ...base,
      eventType: 3,
      title: '-',
      feedbackId
    })
  }

  return { doc: { ...doc, events, choices, results, feedbackNodes }, eventId }
}