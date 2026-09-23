import type { JSX } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { EVENT_TYPES, type EventType } from '../../../shared/types'
import type { FlowData } from '../tree'

type FlowNode = Node<FlowData>

const COLORS: Record<FlowData['kind'], string> = {
  event: '#1677ff',
  option: '#13c2c2',
  result: '#722ed1',
  feedback: '#fa8c16',
  follow: '#8c8c8c'
}

const TYPE_COLOR: Record<EventType, string> = {
  1: '#1677ff',
  2: '#13c2c2',
  3: '#fa8c16',
  4: '#722ed1'
}

function nodeColor(data: FlowData): string {
  if ((data.kind === 'event' || data.kind === 'follow') && data.eventType) return TYPE_COLOR[data.eventType]
  return COLORS[data.kind]
}

function Card({ data }: { data: FlowData }): JSX.Element {
  const color = nodeColor(data)
  const images = data.images ?? []
  return (
    <div
      className="flow-card"
      style={{
        borderColor: data.error ? '#ff4d4f' : color,
        boxShadow: data.error ? '0 0 0 2px #ffccc7' : '0 1px 4px rgba(0,0,0,.08)'
      }}
    >
      <div className="flow-main">
        <div className="flow-kind" style={{ color }}>{kindLabel(data)}</div>
        <div className="flow-title">{data.title}</div>
        <div className="flow-sub">{data.subtitle || ' '}</div>
      </div>
      {images.length ? (
        <div className="flow-thumbs" title={images.map((item) => item.label).join('\n')}>
          <img className="flow-thumb" src={images[0].url} alt={images[0].label} draggable={false} />
          {images.length > 1 ? <span className="flow-thumb-more">+{images.length - 1}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

function kindLabel(data: FlowData): string {
  if ((data.kind === 'event' || data.kind === 'follow') && data.eventType) return EVENT_TYPES[data.eventType]
  if (data.kind === 'event') return '事件'
  if (data.kind === 'option') return '选项'
  if (data.kind === 'result') return '结果'
  if (data.kind === 'feedback') return '对话'
  if (data.followKind === 'pool') return '后续·加池'
  if (data.followKind === 'force') return '后续·强制'
  if (data.followKind === 'unlock') return '后续·解锁'
  return '后续·权重'
}


export function EventFlowNode({ data }: NodeProps<FlowNode>): JSX.Element {
  return (
  <>
    <Handle type="target" position={Position.Left} />
    <Card data={data} />
    <Handle type="source" position={Position.Right} />
  </>
  )
}

export const OptionFlowNode = EventFlowNode
export const ResultFlowNode = EventFlowNode
export const FeedbackFlowNode = EventFlowNode
export const FollowFlowNode = EventFlowNode