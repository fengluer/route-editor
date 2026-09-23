import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeChange,
  type NodeTypes
} from '@xyflow/react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  EventFlowNode,
  FeedbackFlowNode,
  FollowFlowNode,
  OptionFlowNode,
  ResultFlowNode
} from '../nodes/FlowNodes'
import { FLOW_NODE_SIZE, layoutNodes } from '../layout'
import { useDocStore, type SelectedNode } from '../store'
import { buildEventGraph, type FlowData } from '../tree'
import type { Issue } from '../validation'

const nodeTypes: NodeTypes = {
  event: EventFlowNode,
  option: OptionFlowNode,
  result: ResultFlowNode,
  feedback: FeedbackFlowNode,
  follow: FollowFlowNode
}

interface Props {
  issues: Issue[]
}

function toSelected(node: Node<FlowData>): SelectedNode {
  if (node.data.kind === 'follow') {
    return {
      kind: 'follow',
      resultId: node.data.resultId ?? '',
      followKind: node.data.followKind ?? 'pool',
      eventId: node.data.entityId
    }
  }
  return { kind: node.data.kind, id: node.data.entityId }
}

function CanvasInner({ issues }: Props): JSX.Element {
  const doc = useDocStore((state) => state.doc)
  const images = useDocStore((state) => state.images)
  const selectedEventId = useDocStore((state) => state.selectedEventId)
  const selected = useDocStore((state) => state.selected)
  const layoutNonce = useDocStore((state) => state.layoutNonce)
  const selectNode = useDocStore((state) => state.selectNode)
  const selectEvent = useDocStore((state) => state.selectEvent)
  const { fitView } = useReactFlow()
  const [drags, setDrags] = useState<Record<string, { x: number; y: number }>>({})
  const [dragKey, setDragKey] = useState('')

  const built = useMemo(() => {
    if (!selectedEventId) return { nodes: [] as Node<FlowData>[], edges: [] }
    return buildEventGraph(doc, selectedEventId, issues, images)
  }, [doc, selectedEventId, issues, images])

  const structureKey = `${selectedEventId ?? ''}|${layoutNonce}|${built.nodes.map((node) => node.id).join('|')}|${built.edges.map((edge) => edge.id).join('|')}`
  if (dragKey !== structureKey) {
    setDragKey(structureKey)
    setDrags({})
  }
  const activeDrags = dragKey === structureKey ? drags : {}

  const layoutCache = useRef<{ key: string; positions: Map<string, { x: number; y: number }> }>({
    key: '',
    positions: new Map()
  })
  if (layoutCache.current.key !== structureKey) {
    const laid = layoutNodes(built.nodes, built.edges)
    layoutCache.current = {
      key: structureKey,
      positions: new Map(laid.map((node) => [node.id, node.position]))
    }
  }
  const positions = layoutCache.current.positions

  const selectedId = useMemo(() => {
    if (!selected || !selectedEventId) return undefined
    if (selected.kind === 'follow') return `follow:${selected.resultId}:${selected.followKind}:${selected.eventId}`
    if (selected.kind === 'feedback') return `fb:${selected.id}`
    if (selected.kind === 'event') return `event:${selected.id}`
    if (selected.kind === 'option') return `option:${selected.id}`
    if (selected.kind === 'result') return `result:${selected.id}`
    return undefined
  }, [selected, selectedEventId])

  const nodes = built.nodes.map((node, index) => ({
    ...node,
    position: activeDrags[node.id] ?? positions.get(node.id) ?? { x: 40, y: 40 + index * (FLOW_NODE_SIZE.height + 18) },
    width: FLOW_NODE_SIZE.width,
    height: FLOW_NODE_SIZE.height,
    style: { width: FLOW_NODE_SIZE.width, height: FLOW_NODE_SIZE.height },
    draggable: true,
    selected: node.id === selectedId
  }))

  useLayoutEffect(() => {
    if (!selectedEventId || nodes.length === 0) return
    fitView({ padding: 0.18, duration: 0 })
  }, [structureKey, selectedEventId, nodes.length, fitView])

  const onNodesChange = useCallback((changes: NodeChange<Node<FlowData>>[]) => {
    const next: Record<string, { x: number; y: number }> = {}
    let hit = false
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        next[change.id] = change.position
        hit = true
      }
    }
    if (!hit) return
    setDrags((prev) => ({ ...prev, ...next }))
  }, [])

  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const tag = (event.target as HTMLElement | null)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        useDocStore.getState().deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!selectedEventId) {
    return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#888' }}>选择左侧事件</div>
  }

  return (
    <ReactFlow
      key={structureKey}
      nodes={nodes}
      edges={built.edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      panOnDrag
      selectionOnDrag={false}
      nodeDragThreshold={3}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      onNodeClick={(_event, node) => selectNode(toSelected(node as Node<FlowData>))}
      onNodeDoubleClick={(_event, node) => {
        const data = (node as Node<FlowData>).data
        if (data.kind === 'follow') selectEvent(data.entityId)
      }}
      minZoom={0.2}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <MiniMap pannable zoomable />
      <Controls showInteractive />
    </ReactFlow>
  )
}

export function FlowCanvas({ issues }: Props): JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner issues={issues} />
    </ReactFlowProvider>
  )
}
