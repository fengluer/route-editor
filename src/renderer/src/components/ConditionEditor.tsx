import type { JSX, ReactNode } from 'react'
import { Button, Input, Select, Space } from 'antd'
import { CODE_LABELS, TYPE_LABELS, parseCondition, serializeCondition, type ConditionAtom } from '../../../shared/conditions'

interface Props {
  value: string
  onChange: (value: string) => void
}

const codeOptions = Object.entries(CODE_LABELS).map(([value, label]) => ({ value, label: `${value} ${label}` }))
const typeOptions = [
  ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label: `${value} ${label}` })),
  { value: 'custom', label: '自定义类型' }
]

export function ConditionEditor({ value, onChange }: Props): JSX.Element {
  const atoms = parseCondition(value)

  const update = (next: ConditionAtom[]): void => {
    onChange(serializeCondition(next))
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      {atoms.map((atom, index) => (
        <Space key={`${index}-${atom.kind}`} wrap>
          <Select
            style={{ width: 110 }}
            value={atom.kind}
            options={[
              { value: 'code', label: '固定码' },
              { value: 'typed', label: '类型:值' },
              { value: 'raw', label: '自定义' }
            ]}
            onChange={(kind) => {
              const next = [...atoms]
              if (kind === 'code') next[index] = { kind: 'code', code: '10' }
              else if (kind === 'typed') next[index] = { kind: 'typed', type: '4', value: '' }
              else next[index] = { kind: 'raw', text: '' }
              update(next)
            }}
          />
          {atom.kind === 'code' ? (
            <Select
              style={{ width: 140 }}
              value={atom.code}
              options={codeOptions}
              onChange={(code) => {
                const next = [...atoms]
                next[index] = { kind: 'code', code }
                update(next)
              }}
            />
          ) : null}
          {atom.kind === 'typed' ? (
            <>
              <Select
                style={{ width: 130 }}
                value={TYPE_LABELS[atom.type] ? atom.type : 'custom'}
                options={typeOptions}
                onChange={(type) => {
                  const next = [...atoms]
                  next[index] = { kind: 'typed', type: type === 'custom' ? atom.type : type, value: atom.value }
                  update(next)
                }}
              />
              <Input
                style={{ width: 120 }}
                placeholder="值"
                value={atom.value}
                onChange={(event) => {
                  const next = [...atoms]
                  next[index] = { ...atom, value: event.target.value }
                  update(next)
                }}
              />
            </>
          ) : null}
          {atom.kind === 'raw' ? (
            <Input
              style={{ width: 180 }}
              value={atom.text}
              onChange={(event) => {
                const next = [...atoms]
                next[index] = { kind: 'raw', text: event.target.value }
                update(next)
              }}
            />
          ) : null}
          <Button
            size="small"
            onClick={() => update(atoms.filter((_, i) => i !== index))}
          >
            删
          </Button>
        </Space>
      ))}
      <Space>
        <Button size="small" onClick={() => update([...atoms, { kind: 'code', code: '10' }])}>
          加条件
        </Button>
        <Input
          placeholder="或直接填原文"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </Space>
    </Space>
  )
}