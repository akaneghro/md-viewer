import type { DragDropEvent } from '@tauri-apps/api/webview'
import { isValidMarkdownFile } from '~/utils/constants'

interface DragDropHandlers {
  /** Called with the first markdown file of a drop */
  onFile: (path: string) => void | Promise<void>
  /** Called when a drop contains no markdown file */
  onUnsupported: () => void
}

/**
 * State and handler for Tauri's native drag & drop events
 * (`getCurrentWebview().onDragDropEvent`), which carry real file paths.
 */
export function useDragDrop(handlers: DragDropHandlers) {
  const isDragging = ref(false)

  async function handleDragDrop(event: DragDropEvent) {
    switch (event.type) {
      case 'enter':
      case 'over':
        isDragging.value = true
        return
      case 'leave':
        isDragging.value = false
        return
      case 'drop': {
        isDragging.value = false
        const path = event.paths.find(isValidMarkdownFile)
        if (path) {
          await handlers.onFile(path)
        }
        else {
          handlers.onUnsupported()
        }
      }
    }
  }

  return {
    isDragging: readonly(isDragging),
    handleDragDrop,
  }
}
