import { contextBridge, ipcRenderer } from 'electron'
import type { EditorDocument, FileResult, MenuAction, PreviewMap, PreviewPickResult, SaveResult } from '../shared/types'

contextBridge.exposeInMainWorld('api', {
  openFile: (): Promise<FileResult> => ipcRenderer.invoke('file:open'),
  saveFile: (doc: EditorDocument): Promise<SaveResult> => ipcRenderer.invoke('file:save', doc),
  saveFileAs: (doc: EditorDocument): Promise<SaveResult> => ipcRenderer.invoke('file:saveAs', doc),
  openDefault: (): Promise<FileResult> => ipcRenderer.invoke('file:openDefault'),
  listPreviews: (): Promise<PreviewMap> => ipcRenderer.invoke('preview:list'),
  previewDir: (): Promise<string> => ipcRenderer.invoke('preview:dir'),
  pickPreview: (id: string): Promise<PreviewPickResult> => ipcRenderer.invoke('preview:pick', id),
  clearPreview: (id: string): Promise<PreviewMap> => ipcRenderer.invoke('preview:clear', id),
  onMenu: (callback: (action: MenuAction) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: MenuAction): void => {
      callback(action)
    }
    ipcRenderer.on('menu', listener)
    return () => {
      ipcRenderer.removeListener('menu', listener)
    }
  }
})