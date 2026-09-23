import { PictureOutlined } from '@ant-design/icons'
import { Button, Input, Select, Space } from 'antd'
import type { JSX } from 'react'
import { formatKeyed, formatPoints, parseKeyed, parsePoints, type KeyedValue } from '../../../shared/ids'
import type { WalkResource } from '../../../shared/types'
import { pickResourceImage } from '../previews'
import { useDocStore } from '../store'

function sameKeyed(raw: string): boolean {
  const text = raw.trim()
  if (!text) return true
  return formatKeyed(parseKeyed(text)) === text
}

function samePoints(raw: string): boolean {
  const text = raw.trim()
  if (!text) return true
  return formatPoints(parsePoints(text)) === text
}

export function KeyedListEditor({
  value,
  onChange,
  resources,
  valueLabel
}: {
  value: string
  onChange: (value: string) => void
  resources?: WalkResource[]
  valueLabel: string
}): JSX.Element {
  const images = useDocStore((state) => state.images)
  if (!sameKeyed(value)) {
    return <Input value={value} onChange={(event) => onChange(event.target.value)} />
  }
  const items = parseKeyed(value)
  const write = (next: KeyedValue[]): void => onChange(formatKeyed(next))
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {items.map((item, index) => (
        <Space.Compact key={`${item.id}-${index}`} style={{ width: '100%' }}>
          {resources ? (
            <Button
              title="设置素材图片"
              style={{ width: 32, padding: 0 }}
              disabled={!item.id}
              icon={
                images[item.id] ? (
                  <img className="resource-pick-img" src={images[item.id]} alt="" />
                ) : (
                  <PictureOutlined />
                )
              }
              onClick={() => void pickResourceImage(item.id)}
            />
          ) : null}
          {resources ? (
            <Select
              style={{ width: '46%' }}
              value={item.id || undefined}
              placeholder="素材"
              options={resources.map((resource) => ({
                value: resource.id,
                label: images[resource.id] ? `${resource.id} ${resource.filename} · 有图` : `${resource.id} ${resource.filename}`
              }))}
              onChange={(id) => write(items.map((row, rowIndex) => (rowIndex === index ? { ...row, id } : row)))}
            />
          ) : (
            <Input
              style={{ width: '42%' }}
              value={item.id}
              placeholder="ID"
              onChange={(event) => write(items.map((row, rowIndex) => (rowIndex === index ? { ...row, id: event.target.value } : row)))}
            />
          )}
          <Input
            style={{ width: resources ? '28%' : '46%' }}
            value={item.value}
            placeholder={valueLabel}
            onChange={(event) => write(items.map((row, rowIndex) => (rowIndex === index ? { ...row, value: event.target.value } : row)))}
          />
          <Button onClick={() => write(items.filter((_, rowIndex) => rowIndex !== index))}>删</Button>
        </Space.Compact>
      ))}
      <Button
        size="small"
        onClick={() => write([...items, { id: resources?.[0]?.id ?? '1', value: resources ? '1' : '1' }])}
      >
        添加
      </Button>
    </Space>
  )
}

export function PointListEditor({ value, onChange }: { value: string; onChange: (value: string) => void }): JSX.Element {
  if (!samePoints(value)) {
    return <Input value={value} onChange={(event) => onChange(event.target.value)} />
  }
  const items = parsePoints(value)
  const write = (next: { x: string; y: string }[]): void => onChange(formatPoints(next))
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {items.map((item, index) => (
        <Space.Compact key={`${item.x}-${item.y}-${index}`} style={{ width: '100%' }}>
          <Input
            value={item.x}
            placeholder="X"
            onChange={(event) => write(items.map((row, rowIndex) => (rowIndex === index ? { ...row, x: event.target.value } : row)))}
          />
          <Input
            value={item.y}
            placeholder="Y"
            onChange={(event) => write(items.map((row, rowIndex) => (rowIndex === index ? { ...row, y: event.target.value } : row)))}
          />
          <Button onClick={() => write(items.filter((_, rowIndex) => rowIndex !== index))}>删</Button>
        </Space.Compact>
      ))}
      <Button size="small" onClick={() => write([...items, { x: '1', y: '1' }])}>添加坐标</Button>
    </Space>
  )
}
