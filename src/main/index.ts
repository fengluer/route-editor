import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import { access, copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { EditorDocument, FileResult, MenuAction, PreviewPickResult, SaveResult } from '../shared/types'
import { clearPreview, isPreviewId, listPreviewMap, migrateLegacyPreviews, previewFolder, savePreview } from './previews'
import { findTableFiles, loadDataDir, ROUTE_FILE, saveDataDir, tableFileNames } from './workbook'

let mainWindow: BrowserWindow | null = null
let currentPath: string | null = null

function applicationDirectory(): string {
  if (app.isPackaged) return dirname(app.getPath('exe'))
  return app.getAppPath()
}

async function previewImages() {
  await migrateLegacyPreviews(currentPath, applicationDirectory())
  return listPreviewMap(applicationDirectory())
}

function sendMenu(action: MenuAction): void {
  mainWindow?.webContents.send('menu', action)
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '打开目录', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open') },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => sendMenu('save') },
        { label: '另存为', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenu('saveAs') },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => sendMenu('undo') },
        { label: '重做', accelerator: 'CmdOrCtrl+Y', click: () => sendMenu('redo') }
      ]
    },
    {
      label: '插入',
      submenu: [
        { label: '新建路牌', click: () => sendMenu('newGuide') },
        { label: '新建抉择', click: () => sendMenu('newDecision') },
        { label: '新建反馈', click: () => sendMenu('newFeedback') },
        { label: '新建剧情', click: () => sendMenu('newPlot') }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '自动布局', accelerator: 'CmdOrCtrl+L', click: () => sendMenu('layout') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    title: '路线编辑器',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}


async function openDir(dir: string): Promise<FileResult> {
  try {
    const doc = await loadDataDir(dir)
    currentPath = dir
    return { ok: true, path: dir, doc }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function hasWorkbooks(dir: string): Promise<boolean> {
  const found = await findTableFiles(dir).catch(() => ({}))
  return tableFileNames().every((filename) => Object.values(found).includes(filename))
}

async function copyTables(from: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true })
  for (const filename of tableFileNames()) {
    await copyFile(join(from, filename), join(to, filename))
  }
}

async function copyIfMissing(from: string, to: string, filename: string): Promise<void> {
  try {
    await access(join(to, filename))
    return
  } catch {
    // 目标里还没有这张表
  }
  try {
    await access(join(from, filename))
  } catch {
    return
  }
  await mkdir(to, { recursive: true })
  await copyFile(join(from, filename), join(to, filename))
}

async function openDefault(): Promise<FileResult> {
  const bundledCandidates = app.isPackaged
    ? [join(process.resourcesPath, 'DataTable'), join(process.cwd(), 'DataTable')]
    : [join(process.cwd(), 'DataTable')]
  let bundled: string | null = null
  for (const dir of bundledCandidates) {
    if (await hasWorkbooks(dir)) {
      bundled = dir
      break
    }
  }
  if (!bundled) return { ok: false, error: '未找到 DataTable 目录' }
  if (!app.isPackaged) return openDir(bundled)

  const writable = join(app.getPath('documents'), '路线编辑器', 'DataTable')
  if (!(await hasWorkbooks(writable))) {
    await copyTables(bundled, writable)
  }
  await copyIfMissing(bundled, writable, ROUTE_FILE)
  return openDir(writable)
}

async function openFile(): Promise<FileResult> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '打开表格目录',
    properties: ['openDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true }
  return openDir(result.filePaths[0])
}

async function saveTo(dir: string, doc: EditorDocument): Promise<SaveResult> {
  try {
    await mkdir(dir, { recursive: true })
    await saveDataDir(dir, doc)
    currentPath = dir
    return { ok: true, path: dir }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function pickPreview(id: string): Promise<PreviewPickResult> {
  if (!currentPath) return { ok: false, error: '请先打开表格目录' }
  if (!isPreviewId(id)) return { ok: false, error: '素材 ID 无效' }
  const picked = await dialog.showOpenDialog(mainWindow!, {
    title: '选择素材图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }]
  })
  if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true }
  try {
    await savePreview(applicationDirectory(), id, picked.filePaths[0])
    return { ok: true, images: await previewImages() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function saveFile(doc: EditorDocument): Promise<SaveResult> {
  if (!currentPath) return saveFileAs(doc)
  return saveTo(currentPath, doc)
}

async function saveFileAs(doc: EditorDocument): Promise<SaveResult> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择保存目录',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: currentPath ?? undefined
  })
  if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true }
  return saveTo(result.filePaths[0], doc)
}

app.whenReady().then(() => {
  createMenu()
  createWindow()
  ipcMain.handle('file:open', () => openFile())
  ipcMain.handle('file:save', (_event, doc: EditorDocument) => saveFile(doc))
  ipcMain.handle('file:saveAs', (_event, doc: EditorDocument) => saveFileAs(doc))
  ipcMain.handle('file:openDefault', () => openDefault())
  ipcMain.handle('preview:list', () => previewImages())
  ipcMain.handle('preview:dir', () => previewFolder(applicationDirectory()))
  ipcMain.handle('preview:pick', (_event, id: string) => pickPreview(id))
  ipcMain.handle('preview:clear', async (_event, id: string) => {
    await clearPreview(applicationDirectory(), id)
    return previewImages()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})