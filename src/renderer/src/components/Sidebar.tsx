import { Badge, Button, Input, Segmented, Tree } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useMemo, useState , type JSX } from 'react'
import { EVENT_TYPES } from '../../../shared/types'
import { useDocStore } from '../store'
import { issuesForEvent, type Issue } from '../validation'

interface Props {
  issues: Issue[]
}

export function Sidebar({ issues }: Props): JSX.Element {
  const doc = useDocStore((state) => state.doc)
  const selectedEventId = useDocStore((state) => state.selectedEventId)
  const selected = useDocStore((state) => state.selected)
  const selectEvent = useDocStore((state) => state.selectEvent)
  const selectNode = useDocStore((state) => state.selectNode)
  const addResource = useDocStore((state) => state.addResource)
  const images = useDocStore((state) => state.images)
  const [keyword, setKeyword] = useState('')
  const [pane, setPane] = useState<'event' | 'resource'>('event')

  const treeData = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    const events = doc.events.filter((event) => {
      if (!q) return true
      return `${event.id} ${event.title} ${event.routeSlot} ${event.note}`.toLowerCase().includes(q)
    })
    const routes = new Map<string, typeof events>()
    for (const event of events) {
      if (!event.routeSlot) continue
      const list = routes.get(event.routeSlot) ?? []
      list.push(event)
      routes.set(event.routeSlot, list)
    }

    const toNode = (event: (typeof events)[number]): DataNode => {
      const count = issuesForEvent(issues, event.id).length
      const titleText = event.title && event.title !== '-' ? event.title : `${EVENT_TYPES[event.eventType]} #${event.id}`
      return {
        key: `event-${event.id}`,
        title: (
          <span>
            {count ? <Badge status="error" /> : null}
            {event.id} {titleText}
          </span>
        )
      }
    }

    const nodes: DataNode[] = ([1, 2, 3, 4] as const).map((type) => {
      const list = events.filter((event) => event.eventType === type)
      return {
        key: `type-${type}`,
        title: `${EVENT_TYPES[type]} (${list.length})`,
        children: list.map(toNode)
      }
    })
    if (routes.size) {
      nodes.push({
        key: 'route',
        title: '路线槽位',
        children: [...routes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([slot, list]) => ({
          key: `route-${slot}`,
          title: `${slot} (${list.length})`,
          children: list.map(toNode)
        }))
      })
    }
    return nodes
  }, [doc.events, issues, keyword])

  const resourceTree = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    const list = doc.resources.filter((item) => {
      if (!q) return true
      return `${item.id} ${item.filename} ${item.type}`.toLowerCase().includes(q)
    })
    const groups = new Map<string, typeof list>()
    for (const item of list) {
      const name = doc.resourceTypes.find((type) => type.id === item.type)?.name || `类型 ${item.type || '未标'}`
      const bucket = groups.get(name) ?? []
      bucket.push(item)
      groups.set(name, bucket)
    }
    return [...groups.entries()].map(([name, items]) => ({
      key: `rtype-${name}`,
      title: `${name} (${items.length})`,
      children: items.map((item) => ({
        key: `resource-${item.id}`,
        title: (
          <span className="resource-tree-label">
            {images[item.id] ? <img className="resource-tree-thumb" src={images[item.id]} alt="" /> : null}
            {item.id} {item.filename}
          </span>
        )
      }))
    }))
  }, [doc.resourceTypes, doc.resources, images, keyword])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 8 }}>
      <Segmented
        block
        value={pane}
        options={[{ label: '事件', value: 'event' }, { label: '素材', value: 'resource' }]}
        onChange={(value) => setPane(value as 'event' | 'resource')}
      />
      <Input.Search
        allowClear
        style={{ marginTop: 8 }}
        placeholder={pane === 'event' ? '搜索事件' : '搜索素材'}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      {pane === 'resource' ? <Button style={{ marginTop: 8 }} onClick={addResource}>新增素材</Button> : null}
      <div style={{ flex: 1, overflow: 'auto', marginTop: 8 }}>
        {pane === 'event' ? (
          <Tree
            blockNode
            defaultExpandAll
            selectedKeys={selectedEventId ? [`event-${selectedEventId}`] : []}
            treeData={treeData}
            onSelect={(keys) => {
              const key = String(keys[0] ?? '')
              if (key.startsWith('event-')) selectEvent(key.slice(6))
            }}
          />
        ) : (
          <Tree
            blockNode
            defaultExpandAll
            selectedKeys={selected?.kind === 'resource' ? [`resource-${selected.id}`] : []}
            treeData={resourceTree}
            onSelect={(keys) => {
              const key = String(keys[0] ?? '')
              if (key.startsWith('resource-')) selectNode({ kind: 'resource', id: key.slice(9) })
            }}
          />
        )}
      </div>
    </div>
  )
}