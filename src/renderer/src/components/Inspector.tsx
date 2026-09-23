import { useEffect, useState, type JSX, type ReactNode } from 'react'
import { Button, Collapse, Divider, Input, Select, Space, Typography } from 'antd'
import { EVENT_TYPES, FEEDBACK_NODE_TYPES, FILE_TYPES, type EventType, type WalkRoute } from '../../../shared/types'
import { formatPool, formatRouteSlot, joinIds, parsePool, parseRouteSlot, splitIds } from '../../../shared/ids'
import { clearResourceImage, pickResourceImage } from '../previews'
import { useDocStore } from '../store'
import { ConditionEditor } from './ConditionEditor'
import { KeyedListEditor, PointListEditor } from './TableFields'

const { Text } = Typography

function rhythmType(route: WalkRoute | undefined, position: string): EventType | null {
  const index = Number(position) - 1
  if (!route || index < 0) return null
  const raw = route.rhythm.split(/[,，]/)[index]?.trim()
  if (raw === '1' || raw === '2' || raw === '3' || raw === '4') return Number(raw) as EventType
  return null
}

function RouteSlotField({
  value,
  routes,
  onChange
}: {
  value: string
  routes: WalkRoute[]
  onChange: (value: string) => void
}): JSX.Element {
  const parsed = parseRouteSlot(value)
  const canonical = parsed ? formatRouteSlot(parsed.routeId, parsed.position) : ''
  if (value.trim() && canonical !== value.trim()) {
    return <Input value={value} onChange={(event) => onChange(event.target.value)} />
  }
  if (!routes.length) {
    return <Input value={value} placeholder="路线ID:位置" onChange={(event) => onChange(event.target.value)} />
  }
  const route = routes.find((item) => item.id === parsed?.routeId)
  const count = Math.max(Number(route?.count) || 0, Number(parsed?.position) || 0)
  const positions = Array.from({ length: count }, (_, index) => String(index + 1))
  const expected = rhythmType(route, parsed?.position ?? '')
  return (
    <>
      <Space.Compact style={{ width: '100%' }}>
        <Select
          style={{ width: '64%' }}
          placeholder="路线"
          allowClear
          value={parsed?.routeId}
          options={routes.map((item) => ({
            value: item.id,
            label: `${item.id} 地点${item.location || '-'} · ${item.count}节点`
          }))}
          onChange={(routeId) => onChange(routeId ? formatRouteSlot(routeId, '1') : '')}
        />
        <Select
          style={{ width: '36%' }}
          placeholder="位置"
          disabled={!parsed?.routeId}
          value={parsed?.position}
          options={positions.map((position) => {
            const type = rhythmType(route, position)
            return { value: position, label: type ? `${position} ${EVENT_TYPES[type]}` : position }
          })}
          onChange={(position) => {
            if (parsed?.routeId) onChange(formatRouteSlot(parsed.routeId, position))
          }}
        />
      </Space.Compact>
      {route ? (
        <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
          节奏 {route.rhythm || '-'}
          {expected ? `，当前位置是${EVENT_TYPES[expected]}` : ''}
        </div>
      ) : null}
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

export function Inspector(): JSX.Element {
  const doc = useDocStore((state) => state.doc)
  const selected = useDocStore((state) => state.selected)
  const selectedEventId = useDocStore((state) => state.selectedEventId)
  const patchEvent = useDocStore((state) => state.patchEvent)
  const patchChoice = useDocStore((state) => state.patchChoice)
  const patchResult = useDocStore((state) => state.patchResult)
  const patchFeedback = useDocStore((state) => state.patchFeedback)
  const addOption = useDocStore((state) => state.addOption)
  const addResultToOption = useDocStore((state) => state.addResultToOption)
  const addFeedbackChild = useDocStore((state) => state.addFeedbackChild)
  const addFollow = useDocStore((state) => state.addFollow)
  const addOptionToFeedback = useDocStore((state) => state.addOptionToFeedback)
  const addResultToFeedback = useDocStore((state) => state.addResultToFeedback)
  const images = useDocStore((state) => state.images)
  const path = useDocStore((state) => state.path)
  const patchResource = useDocStore((state) => state.patchResource)
  const deleteSelected = useDocStore((state) => state.deleteSelected)
  const selectEvent = useDocStore((state) => state.selectEvent)
  const [previewDir, setPreviewDir] = useState('')

  useEffect(() => {
    void window.api.previewDir().then(setPreviewDir)
  }, [])

  if (!selected) return <div style={{ padding: 16 }}><Text type="secondary">未选择节点</Text></div>

  const actions = (
    <Space wrap>
      {selected.kind === 'event' && selectedEventId ? (
        <>
          <Button size="small" onClick={() => addOption(selectedEventId)}>加选项</Button>
          <Button size="small" onClick={() => addFeedbackChild(selectedEventId, null, 1)}>加对话根</Button>
        </>
      ) : null}
      {selected.kind === 'option' ? (
        <Button size="small" onClick={() => addResultToOption(selected.id)}>加结果</Button>
      ) : null}
      {selected.kind === 'feedback' && selectedEventId ? (
        <>
          <Button size="small" onClick={() => addFeedbackChild(selectedEventId, selected.id, 1)}>加下一句</Button>
          <Button size="small" onClick={() => addOptionToFeedback(selected.id)}>加选项</Button>
          <Button size="small" onClick={() => addResultToFeedback(selected.id)}>挂结果</Button>
        </>
      ) : null}
      {selected.kind === 'result' ? (
        <Button
          size="small"
          onClick={() => {
            const first = doc.events.find((item) => item.id !== selectedEventId)
            addFollow(selected.id, 'pool', first?.id || selectedEventId || '1')
          }}
        >
          加池后续
        </Button>
      ) : null}
      <Button size="small" danger onClick={deleteSelected}>删除</Button>
    </Space>
  )

  if (selected.kind === 'event') {
    const event = doc.events.find((item) => item.id === selected.id)
    if (!event) return <div style={{ padding: 16 }}>事件不存在</div>
    return (
      <div style={{ padding: 12 }}>
        {actions}
        <Divider />
        <Field label="事件ID"><Input value={event.id} disabled /></Field>
        <Field label="描述文本">
          <Input.TextArea rows={3} value={event.title} onChange={(e) => patchEvent(event.id, { title: e.target.value })} />
        </Field>
        <Field label="事件类型">
          <Select
            style={{ width: '100%' }}
            value={event.eventType}
            options={Object.entries(EVENT_TYPES).map(([value, label]) => ({ value: Number(value), label: `${value} ${label}` }))}
            onChange={(eventType) => patchEvent(event.id, { eventType })}
          />
        </Field>
        <Field label="地点">
          <Input value={event.location} onChange={(e) => patchEvent(event.id, { location: e.target.value })} />
        </Field>
        <Field label="路线ID:出现位置">
          <RouteSlotField
            value={event.routeSlot}
            routes={doc.routes}
            onChange={(routeSlot) => patchEvent(event.id, { routeSlot })}
          />
        </Field>
        <Field label="初始抽取权重">
          <Input value={event.weight} onChange={(e) => patchEvent(event.id, { weight: e.target.value })} />
        </Field>
        <Field label="事件前100m素材">
          <KeyedListEditor
            value={event.resource}
            resources={doc.resources}
            valueLabel="点位"
            onChange={(resource) => patchEvent(event.id, { resource })}
          />
        </Field>
        <Field label="事件标记">
          <Select
            style={{ width: '100%' }}
            value={event.mark || undefined}
            allowClear
            options={[
              { value: '0', label: '0 普通' },
              { value: '1', label: '1 照片事件' }
            ]}
            onChange={(mark) => patchEvent(event.id, { mark: mark ?? '' })}
          />
        </Field>
        <Field label="抽取条件">
          <ConditionEditor value={event.drawCondition} onChange={(drawCondition) => patchEvent(event.id, { drawCondition })} />
        </Field>
        <Field label="备注">
          <Input value={event.note} onChange={(e) => patchEvent(event.id, { note: e.target.value })} />
        </Field>
        <Collapse
          items={[{
            key: 'adv',
            label: '高级 / 预留',
            children: (
              <>
                <Field label="初始解锁状态（废弃）">
                  <Select
                    style={{ width: '100%' }}
                    value={event.unlockState || undefined}
                    allowClear
                    options={[
                      { value: '0', label: '0 已解锁' },
                      { value: '1', label: '1 未解锁' }
                    ]}
                    onChange={(unlockState) => patchEvent(event.id, { unlockState: unlockState ?? '' })}
                  />
                </Field>
                <Field label="选项ID"><Input value={event.optionIds.join(',')} disabled /></Field>
                <Field label="反馈内容ID"><Input value={event.feedbackId} disabled /></Field>
                <Field label="结果id"><Input value={event.resultId} disabled /></Field>
              </>
            )
          }]}
        />
      </div>
    )
  }

  if (selected.kind === 'option') {
    const choice = doc.choices.find((item) => item.id === selected.id)
    if (!choice) return <div style={{ padding: 16 }}>选项不存在</div>
    return (
      <div style={{ padding: 12 }}>
        {actions}
        <Divider />
        <Field label="选项ID"><Input value={choice.id} disabled /></Field>
        <Field label="选项文本">
          <Input value={choice.text} onChange={(e) => patchChoice(choice.id, { text: e.target.value })} />
        </Field>
        <Field label="启用条件">
          <ConditionEditor value={choice.enableCondition} onChange={(enableCondition) => patchChoice(choice.id, { enableCondition })} />
        </Field>
        <Field label="结果ID"><Input value={choice.resultIds.join(',')} disabled /></Field>
      </div>
    )
  }

  if (selected.kind === 'feedback') {
    const node = doc.feedbackNodes.find((item) => item.nodeId === selected.id)
    if (!node) return <div style={{ padding: 16 }}>对话节点不存在</div>
    return (
      <div style={{ padding: 12 }}>
        {actions}
        <Divider />
        <Field label="行ID"><Input value={node.id} disabled /></Field>
        <Field label="节点ID"><Input value={node.nodeId} disabled /></Field>
        <Field label="父节点ID"><Input value={node.parentId} disabled /></Field>
        <Field label="节点类型">
          <Select
            style={{ width: '100%' }}
            value={node.nodeType}
            options={Object.entries(FEEDBACK_NODE_TYPES).map(([value, label]) => ({ value: Number(value), label: `${value} ${label}` }))}
            onChange={(nodeType) => patchFeedback(node.nodeId, { nodeType })}
          />
        </Field>
        <Field label="文字内容">
          <Input.TextArea rows={3} value={node.text} onChange={(e) => patchFeedback(node.nodeId, { text: e.target.value })} />
        </Field>
        <Field label="判定条件">
          <ConditionEditor value={node.condition} onChange={(condition) => patchFeedback(node.nodeId, { condition })} />
        </Field>
        <Field label="判定优先级">
          <Input value={node.priority} onChange={(e) => patchFeedback(node.nodeId, { priority: e.target.value })} />
        </Field>
        <Field label="显示道具">
          <Input value={node.showItem} onChange={(e) => patchFeedback(node.nodeId, { showItem: e.target.value })} />
        </Field>
      </div>
    )
  }

  if (selected.kind === 'follow') {
    const result = doc.results.find((item) => item.id === selected.resultId)
    const target = doc.events.find((item) => item.id === selected.eventId)
    return (
      <div style={{ padding: 12 }}>
        {actions}
        <Divider />
        <Field label="后续类型"><Input value={selected.followKind} disabled /></Field>
        <Field label="目标事件">
          <Input
            value={selected.eventId}
            onChange={(e) => {
              if (!result) return
              if (selected.followKind === 'pool') {
                patchResult(result.id, {
                  addPool: formatPool(parsePool(result.addPool).map((row) =>
                    row.eventId === selected.eventId ? { ...row, eventId: e.target.value } : row
                  ))
                })
              } else if (selected.followKind === 'force') patchResult(result.id, { forceNext: e.target.value })
              else if (selected.followKind === 'unlock') patchResult(result.id, { unlockEvent: e.target.value })
              else {
                patchResult(result.id, {
                  adjustWeight: formatPool(parsePool(result.adjustWeight).map((row) =>
                    row.eventId === selected.eventId ? { ...row, eventId: e.target.value } : row
                  ))
                })
              }
            }}
          />
        </Field>
        {target ? <Button size="small" onClick={() => selectEvent(target.id)}>跳转到该事件</Button> : <Text type="danger">事件不存在</Text>}
      </div>
    )
  }

  if (selected.kind === 'resource') {
    const resource = doc.resources.find((item) => item.id === selected.id)
    if (!resource) return <div style={{ padding: 16 }}>素材不存在</div>
    const typeName = doc.resourceTypes.find((item) => item.id === resource.type)?.name
    return (
      <div style={{ padding: 12 }}>
        {actions}
        <Divider />
        <Field label="素材ID"><Input value={resource.id} disabled /></Field>
        <Field label="素材类型">
          <Select
            style={{ width: '100%' }}
            value={resource.type || undefined}
            options={doc.resourceTypes.map((item) => ({ value: item.id, label: `${item.id} ${item.name}` }))}
            onChange={(type) => patchResource(resource.id, { type })}
          />
        </Field>
        <Field label="类型说明"><Input value={typeName || resource.type} disabled /></Field>
        <Field label="素材资源名">
          <Input value={resource.filename} onChange={(e) => patchResource(resource.id, { filename: e.target.value })} />
        </Field>
        <Field label="文件类型">
          <Select
            style={{ width: '100%' }}
            value={Number(resource.filetype) || undefined}
            options={Object.entries(FILE_TYPES).map(([value, label]) => ({ value: Number(value), label: `${value} ${label}` }))}
            onChange={(filetype) => patchResource(resource.id, { filetype: String(filetype) })}
          />
        </Field>
        <Field label="预览图">
          {images[resource.id] ? (
            <img className="resource-preview" src={images[resource.id]} alt={resource.filename} />
          ) : (
            <div className="resource-preview empty">未设置图片</div>
          )}
          <Space>
            <Button size="small" disabled={!path} onClick={() => void pickResourceImage(resource.id)}>设置图片</Button>
            {images[resource.id] ? (
              <Button size="small" onClick={() => void clearResourceImage(resource.id)}>清除</Button>
            ) : null}
          </Space>
          <div style={{ marginTop: 6, fontSize: 12, color: '#888', wordBreak: 'break-all' }}>
            预览图保存在应用目录的「素材图片」文件夹{previewDir ? `：${previewDir}` : ''}。不会写入 Excel，也不会放进表格目录。
          </div>
        </Field>
      </div>
    )
  }

  const result = doc.results.find((item) => item.id === selected.id)
  if (!result) return <div style={{ padding: 16 }}>结果不存在</div>
  return (
    <div style={{ padding: 12 }}>
      {actions}
      <Divider />
      <Field label="结果ID"><Input value={result.id} disabled /></Field>
      <Field label="结果文本">
        <Input.TextArea rows={3} value={result.text} onChange={(e) => patchResult(result.id, { text: e.target.value })} />
      </Field>
      <Field label="判定条件">
        <ConditionEditor value={result.condition} onChange={(condition) => patchResult(result.id, { condition })} />
      </Field>
      <Field label="判定优先级">
        <Input value={result.priority} onChange={(e) => patchResult(result.id, { priority: e.target.value })} />
      </Field>
      <Field label="体力结算"><Input value={result.stamina} onChange={(e) => patchResult(result.id, { stamina: e.target.value })} /></Field>
      <Field label="清洁结算"><Input value={result.clean} onChange={(e) => patchResult(result.id, { clean: e.target.value })} /></Field>
      <Field label="心情结算"><Input value={result.mood} onChange={(e) => patchResult(result.id, { mood: e.target.value })} /></Field>
      <Field label="粉爪币"><Input value={result.coin} onChange={(e) => patchResult(result.id, { coin: e.target.value })} /></Field>
      <Field label="下一环节抽取池增加事件"><Input value={result.addPool} onChange={(e) => patchResult(result.id, { addPool: e.target.value })} /></Field>
      <Field label="强制下一个环节的事件"><Input value={result.forceNext} onChange={(e) => patchResult(result.id, { forceNext: e.target.value })} /></Field>
      <Collapse
        defaultActiveKey={['scene']}
        items={[{
          key: 'scene',
          label: '场景表现',
          children: (
            <>
              <Field label="事件后100m素材">
                <KeyedListEditor
                  value={result.resource}
                  resources={doc.resources}
                  valueLabel="点位"
                  onChange={(resource) => patchResult(result.id, { resource })}
                />
              </Field>
              <Field label="宠物触发动作">
                <KeyedListEditor value={result.petAction} valueLabel="秒数" onChange={(petAction) => patchResult(result.id, { petAction })} />
              </Field>
              <Field label="隐藏素材">
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  value={splitIds(result.hideRes)}
                  options={doc.resources.map((item) => ({ value: item.id, label: `${item.id} ${item.filename}` }))}
                  onChange={(ids) => patchResult(result.id, { hideRes: joinIds(ids) })}
                />
              </Field>
              <Field label="宠物垂直移动格数">
                <Input value={result.petMove} onChange={(e) => patchResult(result.id, { petMove: e.target.value })} />
              </Field>
            </>
          )
        }, {
          key: 'adv',
          label: '掉落 / 解锁',
          children: (
            <>
              <Field label="特殊掉落拾取物"><Input value={result.dropPickup} onChange={(e) => patchResult(result.id, { dropPickup: e.target.value })} /></Field>
              <Field label="掉落坐标">
                <PointListEditor value={result.dropPos} onChange={(dropPos) => patchResult(result.id, { dropPos })} />
              </Field>
              <Field label="永久解锁事件"><Input value={result.unlockEvent} onChange={(e) => patchResult(result.id, { unlockEvent: e.target.value })} /></Field>
              <Field label="解锁照片"><Input value={result.unlockPhoto} onChange={(e) => patchResult(result.id, { unlockPhoto: e.target.value })} /></Field>
              <Field label="获得道具"><Input value={result.gainItem} onChange={(e) => patchResult(result.id, { gainItem: e.target.value })} /></Field>
              <Field label="扣除拾取物道具"><Input value={result.deductItem} onChange={(e) => patchResult(result.id, { deductItem: e.target.value })} /></Field>
              <Field label="队伍增加标签"><Input value={result.teamTag} onChange={(e) => patchResult(result.id, { teamTag: e.target.value })} /></Field>
              <Field label="调整事件局内权重"><Input value={result.adjustWeight} onChange={(e) => patchResult(result.id, { adjustWeight: e.target.value })} /></Field>
            </>
          )
        }]}
      />
    </div>
  )
}