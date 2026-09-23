import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'

export const FLOW_NODE_SIZE = { width: 220, height: 96 }
const GAP = 18

interface Box {
  id: string
  x: number
  y: number
  w: number
  h: number
}

function overlaps(a: Box, b: Box, gap: number): boolean {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
}

export function resolveOverlaps(boxes: Box[], gap = GAP): Box[] {
  const items = boxes.map((box) => ({ ...box }))
  items.sort((a, b) => a.y - b.y || a.x - b.x)
  for (let i = 0; i < items.length; i++) {
    let guard = 0
    while (guard++ < items.length + 4) {
      let hit = false
      for (let j = 0; j < i; j++) {
        if (!overlaps(items[i], items[j], gap)) continue
        const down = items[j].y + items[j].h + gap - items[i].y
        const right = items[j].x + items[j].w + gap - items[i].x
        if (down <= right) items[i].y += Math.max(down, 1)
        else items[i].x += Math.max(right, 1)
        hit = true
        break
      }
      if (!hit) break
    }
  }
  return items
}

function withSize<T extends Record<string, unknown>>(node: Node<T>, position: { x: number; y: number }): Node<T> {
  return {
    ...node,
    position,
    width: FLOW_NODE_SIZE.width,
    height: FLOW_NODE_SIZE.height,
    style: { width: FLOW_NODE_SIZE.width, height: FLOW_NODE_SIZE.height }
  }
}

function gridLayout<T extends Record<string, unknown>>(nodes: Node<T>[]): Node<T>[] {
  return nodes.map((node, index) =>
    withSize(node, { x: 40, y: 40 + index * (FLOW_NODE_SIZE.height + GAP) })
  )
}

export function layoutNodes<T extends Record<string, unknown>>(nodes: Node<T>[], edges: Edge[]): Node<T>[] {
  if (nodes.length === 0) return []
  const unique = new Map<string, Node<T>>()
  for (const node of nodes) unique.set(node.id, node)
  const list = [...unique.values()]
  try {
    const graph = new dagre.graphlib.Graph()
    graph.setDefaultEdgeLabel(() => ({}))
    graph.setGraph({
      rankdir: 'LR',
      nodesep: 40,
      ranksep: 108,
      edgesep: 28,
      marginx: 36,
      marginy: 36,
      ranker: 'network-simplex'
    })
    for (const node of list) graph.setNode(node.id, { ...FLOW_NODE_SIZE })
    const ids = new Set(list.map((node) => node.id))
    for (const edge of edges) {
      if (ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target) {
        graph.setEdge(edge.source, edge.target)
      }
    }
    dagre.layout(graph)
    const boxes: Box[] = list.map((node, index) => {
      const pos = graph.node(node.id)
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
        return {
          id: node.id,
          x: 40,
          y: 40 + index * (FLOW_NODE_SIZE.height + GAP),
          w: FLOW_NODE_SIZE.width,
          h: FLOW_NODE_SIZE.height
        }
      }
      return {
        id: node.id,
        x: pos.x - FLOW_NODE_SIZE.width / 2,
        y: pos.y - FLOW_NODE_SIZE.height / 2,
        w: FLOW_NODE_SIZE.width,
        h: FLOW_NODE_SIZE.height
      }
    })
    const placed = new Map(resolveOverlaps(boxes).map((box) => [box.id, box]))
    return list.map((node) => {
      const box = placed.get(node.id)
      return withSize(node, { x: box?.x ?? 40, y: box?.y ?? 40 })
    })
  } catch {
    return gridLayout(list)
  }
}

export function overlappingPairs(
  nodes: Array<{ id: string; position: { x: number; y: number }; width?: number; height?: number }>,
  gap = 0
): string[] {
  const boxes: Box[] = nodes.map((node) => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    w: node.width ?? FLOW_NODE_SIZE.width,
    h: node.height ?? FLOW_NODE_SIZE.height
  }))
  const hits: string[] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(boxes[i], boxes[j], gap)) hits.push(`${boxes[i].id} ~ ${boxes[j].id}`)
    }
  }
  return hits
}
