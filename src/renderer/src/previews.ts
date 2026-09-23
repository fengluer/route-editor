import { message } from 'antd'
import { useDocStore } from './store'

export async function pickResourceImage(id: string): Promise<void> {
  if (!id) return
  const result = await window.api.pickPreview(id)
  if (!result.ok) {
    if (!result.cancelled) message.error(result.error || '设置图片失败')
    return
  }
  useDocStore.getState().setImages(result.images)
}

export async function clearResourceImage(id: string): Promise<void> {
  useDocStore.getState().setImages(await window.api.clearPreview(id))
}
