import { Button, Layout, Space, Typography, message } from 'antd'
import { useEffect, useMemo , type JSX } from 'react'
import type { MenuAction } from '../../shared/types'
import { Inspector } from './components/Inspector'
import { FlowCanvas } from './components/FlowCanvas'
import { Sidebar } from './components/Sidebar'
import { Storyline } from './components/Storyline'
import { useDocStore } from './store'
import { validateDoc } from './validation'

const { Header, Sider, Content } = Layout

export default function App(): JSX.Element {
  const doc = useDocStore((state) => state.doc)
  const path = useDocStore((state) => state.path)
  const dirty = useDocStore((state) => state.dirty)
  const load = useDocStore((state) => state.load)
  const setImages = useDocStore((state) => state.setImages)
  const markSaved = useDocStore((state) => state.markSaved)
  const bumpLayout = useDocStore((state) => state.bumpLayout)
  const createFromTemplate = useDocStore((state) => state.createFromTemplate)
  const issues = useMemo(() => validateDoc(doc), [doc])

  const open = async (): Promise<void> => {
    const result = await window.api.openFile()
    if (!result.ok) {
      if (!result.cancelled) message.error(result.error || '打开失败')
      return
    }
    load(result.doc, result.path)
    setImages(await window.api.listPreviews())
    message.success(`已打开 ${result.doc.events.length} 个事件`)
  }

  const save = async (saveAs = false): Promise<void> => {
    const result = saveAs ? await window.api.saveFileAs(useDocStore.getState().doc) : await window.api.saveFile(useDocStore.getState().doc)
    if (!result.ok) {
      if (!result.cancelled) message.error(result.error || '保存失败')
      return
    }
    markSaved(result.path)
    setImages(await window.api.listPreviews())
    message.success('已保存')
  }

  useEffect(() => {
    void window.api.openDefault().then(async (result) => {
      if (result.ok) {
        load(result.doc, result.path)
        setImages(await window.api.listPreviews())
        message.success(`已打开 ${result.doc.events.length} 个事件`)
      }
    })
  }, [load, setImages])

  useEffect(() => {
    return window.api.onMenu((action: MenuAction) => {
      if (action === 'open') void open()
      if (action === 'save') void save(false)
      if (action === 'saveAs') void save(true)
      if (action === 'undo') useDocStore.temporal.getState().undo()
      if (action === 'redo') useDocStore.temporal.getState().redo()
      if (action === 'layout') bumpLayout()
      if (action === 'newGuide') createFromTemplate('guide')
      if (action === 'newDecision') createFromTemplate('decision')
      if (action === 'newFeedback') createFromTemplate('feedback')
      if (action === 'newPlot') createFromTemplate('plot')
    })
  }, [bumpLayout, createFromTemplate, load, markSaved])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) useDocStore.temporal.getState().redo()
        else useDocStore.temporal.getState().undo()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        useDocStore.temporal.getState().redo()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        const tag = (event.target as HTMLElement | null)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') event.preventDefault()
      }
    }
    const blockSelect = (event: Event): void => {
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('selectstart', blockSelect)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('selectstart', blockSelect)
    }
  }, [])

  const title = path ? path.split(/[/\\]/).pop() : '未打开文件'
  const errorCount = issues.filter((item) => item.level === 'error').length

  return (
    <Layout style={{ height: '100%' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 16, paddingInline: 16, background: '#141414' }}>
        <Typography.Text style={{ color: '#fff', fontWeight: 700 }}>路线编辑器</Typography.Text>
        <Typography.Text style={{ color: '#ccc' }}>
          {title}
          {dirty ? ' *' : ''}
        </Typography.Text>
        <Typography.Text style={{ color: errorCount ? '#ff4d4f' : '#52c41a' }}>
          {errorCount ? `${errorCount} 个错误` : '校验通过'}
        </Typography.Text>
        <Space>
          <Button onClick={() => void open()}>打开目录</Button>
          <Button type="primary" onClick={() => void save(false)}>保存</Button>
          <Button onClick={() => void save(true)}>另存为</Button>
          <Button onClick={() => useDocStore.temporal.getState().undo()}>撤销</Button>
          <Button onClick={() => useDocStore.temporal.getState().redo()}>重做</Button>
          <Button onClick={() => bumpLayout()}>自动布局</Button>
          <Button onClick={() => createFromTemplate('guide')}>新建路牌</Button>
          <Button onClick={() => createFromTemplate('decision')}>新建抉择</Button>
          <Button onClick={() => createFromTemplate('feedback')}>新建反馈</Button>
          <Button onClick={() => createFromTemplate('plot')}>新建剧情</Button>
        </Space>
      </Header>
      <Layout>
        <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <Storyline />
        </Sider>
        <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <Sidebar issues={issues} />
        </Sider>
        <Content>
          <FlowCanvas issues={issues} />
        </Content>
        <Sider width={360} theme="light" style={{ borderLeft: '1px solid #f0f0f0', overflow: 'auto' }}>
          <Inspector />
        </Sider>
      </Layout>
    </Layout>
  )
}