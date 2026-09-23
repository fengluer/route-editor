import { useEffect, useMemo, useRef, type JSX } from 'react'
import { EVENT_TYPES, type EventType } from '../../../shared/types'
import { buildStoryline } from '../storyline'
import { useDocStore } from '../store'

const TYPE_COLOR: Record<EventType, string> = {
  1: '#1677ff',
  2: '#13c2c2',
  3: '#fa8c16',
  4: '#722ed1'
}

export function Storyline(): JSX.Element {
  const doc = useDocStore((state) => state.doc)
  const selectedEventId = useDocStore((state) => state.selectedEventId)
  const selectEvent = useDocStore((state) => state.selectEvent)
  const story = useMemo(() => buildStoryline(doc, selectedEventId), [doc, selectedEventId])
  const currentRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedEventId, story?.routeId])

  if (!story) {
    return (
      <div className="story-panel">
        <div className="story-head">故事线</div>
        <div className="story-hint">当前事件还没有挂到路线上。配置路线位置后，结果里的后续会接到下一个节点。</div>
      </div>
    )
  }

  const place = story.route ? `地点 ${story.route.location || '-'}` : '基础路线表中没有这条路线'
  const weight = story.route?.weight ? `权重 ${story.route.weight}` : ''

  return (
    <div className="story-panel">
      <div className="story-head">
        <div>故事线 · 路线 {story.routeId}</div>
        <div className="story-meta">{[place, weight, `${story.steps.length} 个节点`].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="story-flow">
        {story.steps.map((step, index) => {
          const shownType = step.events.length === 1
            ? step.events[0].eventType
            : step.events.length > 1 && step.events.every((event) => event.eventType === step.events[0].eventType)
              ? step.events[0].eventType
              : step.expectedType
          const color = shownType ? TYPE_COLOR[shownType] : '#8c8c8c'
          const here = step.events.some((event) => event.id === selectedEventId)
          const typeText = shownType ? EVENT_TYPES[shownType] : '未定'
          return (
            <div className="story-step" key={step.position}>
              <div className="story-rail" aria-hidden="true">
                <span className="story-dot" style={{ background: color, boxShadow: here ? `0 0 0 3px ${color}33` : undefined }} />
                {index < story.steps.length - 1 ? <span className="story-line" /> : null}
              </div>
              <div className={`story-card${here ? ' current' : ''}`} style={{ borderColor: here ? color : '#f0f0f0' }}>
                <div className="story-kind">
                  <span className="story-type" style={{ color, background: `${color}14` }}>{typeText}</span>
                  <span>节点 {step.position}{step.fromFollow ? ' · 后续' : ''}</span>
                </div>
                {step.events.length ? (
                  step.events.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      ref={event.id === selectedEventId ? currentRef : undefined}
                      className={`story-event${event.id === selectedEventId ? ' on' : ''}`}
                      onClick={() => selectEvent(event.id)}
                    >
                      <span className="story-type" style={{ color: TYPE_COLOR[event.eventType], background: `${TYPE_COLOR[event.eventType]}14` }}>
                        {EVENT_TYPES[event.eventType]}
                      </span>
                      <span>{event.via ? `${event.via} ` : ''}{event.id} {event.title}</span>
                    </button>
                  ))
                ) : (
                  <div className="story-empty">这一节点还没有后续事件</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
