import { copyFile, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { PreviewMap } from '../shared/types'

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024

export function previewFolder(appDir: string): string {
  return join(appDir, '素材图片')
}

export async function migrateLegacyPreviews(dataDir: string | null, appDir: string): Promise<void> {
  if (!dataDir) return
  const legacy = join(dataDir, '.route-editor', 'previews')
  let names: string[]
  try {
    names = await readdir(legacy)
  } catch {
    return
  }
  const images = names.filter((name) => idFromFilename(name))
  if (!images.length) {
    await rm(join(dataDir, '.route-editor'), { recursive: true, force: true }).catch(() => undefined)
    return
  }
  const dest = previewFolder(appDir)
  await mkdir(dest, { recursive: true })
  for (const name of images) {
    const target = join(dest, name)
    try {
      await stat(target)
    } catch {
      await copyFile(join(legacy, name), target)
    }
    await rm(join(legacy, name), { force: true })
  }
  await rm(join(dataDir, '.route-editor'), { recursive: true, force: true }).catch(() => undefined)
}

export function isPreviewId(id: string): boolean {
  return /^[\w-]+$/.test(id)
}

function idFromFilename(filename: string): string | null {
  const ext = extname(filename).toLowerCase()
  if (!IMAGE_EXTS.has(ext)) return null
  const id = filename.slice(0, -ext.length)
  return isPreviewId(id) ? id : null
}

export async function listPreviewMap(dir: string | null): Promise<PreviewMap> {
  if (!dir) return {}
  const folder = previewFolder(dir)
  let names: string[]
  try {
    names = await readdir(folder)
  } catch {
    return {}
  }
  const images: PreviewMap = {}
  for (const name of names) {
    const id = idFromFilename(name)
    if (!id || images[id]) continue
    const file = join(folder, name)
    const info = await stat(file)
    if (info.size > MAX_PREVIEW_BYTES) continue
    const ext = extname(name).toLowerCase()
    const bytes = await readFile(file)
    images[id] = `data:${IMAGE_MIME[ext] || 'application/octet-stream'};base64,${bytes.toString('base64')}`
  }
  return images
}

async function removePreviewFiles(dir: string, id: string): Promise<void> {
  const folder = previewFolder(dir)
  let names: string[]
  try {
    names = await readdir(folder)
  } catch {
    return
  }
  await Promise.all(
    names
      .filter((name) => idFromFilename(name) === id)
      .map((name) => rm(join(folder, name), { force: true }))
  )
}

export async function savePreview(dir: string, id: string, sourceFile: string): Promise<void> {
  if (!isPreviewId(id)) throw new Error('素材 ID 无效')
  const ext = extname(sourceFile).toLowerCase()
  if (!IMAGE_EXTS.has(ext)) throw new Error('请选择 png、jpg、webp、gif 或 bmp 图片')
  const info = await stat(sourceFile)
  if (info.size > MAX_PREVIEW_BYTES) throw new Error('图片需小于 8MB')
  const folder = previewFolder(dir)
  await mkdir(folder, { recursive: true })
  await removePreviewFiles(dir, id)
  await copyFile(sourceFile, join(folder, `${id}${ext}`))
}

export async function clearPreview(dir: string, id: string): Promise<void> {
  if (!isPreviewId(id)) return
  await removePreviewFiles(dir, id)
}


