import type { EditorDocument, FileResult, MenuAction, PreviewMap, PreviewPickResult, SaveResult } from '../../shared/types'

declare global {
  interface Window {
    api: {
      openFile: () => Promise<FileResult>
      saveFile: (doc: EditorDocument) => Promise<SaveResult>
      saveFileAs: (doc: EditorDocument) => Promise<SaveResult>
      openDefault: () => Promise<FileResult>
      listPreviews: () => Promise<PreviewMap>
      previewDir: () => Promise<string>
      pickPreview: (id: string) => Promise<PreviewPickResult>
      clearPreview: (id: string) => Promise<PreviewMap>
      onMenu: (callback: (action: MenuAction) => void) => () => void
    }
  }
}

export {}