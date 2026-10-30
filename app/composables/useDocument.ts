import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs'
import { renderMarkdown, type TocItem } from '~/utils/markdown'
import { useRecentsStore } from '~/stores/recents'
import { VALID_MD_EXTENSIONS, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '~/utils/constants'

interface DocumentState {
  currentPath: string | null
  content: string
  html: string
  toc: TocItem[]
  error: string | null
  isLoading: boolean
  isEditing: boolean
  editContent: string
  isDirty: boolean
}

const state = reactive<DocumentState>({
  currentPath: null,
  content: '',
  html: '',
  toc: [],
  error: null,
  isLoading: false,
  isEditing: false,
  editContent: '',
  isDirty: false,
})

const fileDir = computed(() => {
  if (!state.currentPath) return null
  const parts = state.currentPath.split(/[/\\]/)
  parts.pop()
  // A document at the POSIX root ('/README.md') leaves only the empty root segment
  return parts.join('/') || (state.currentPath.startsWith('/') ? '/' : '')
})

let editRenderTimeout: ReturnType<typeof setTimeout> | null = null
let watchersInitialized = false
let _colorMode: ReturnType<typeof useColorMode> | null = null

async function render() {
  if (!state.content) {
    state.html = ''
    state.toc = []
    return
  }

  const isDark = _colorMode?.value === 'dark'
  const result = await renderMarkdown(state.content, fileDir.value, isDark)
  state.html = result.html
  state.toc = result.toc
}

function initWatchers(colorMode: ReturnType<typeof useColorMode>) {
  if (watchersInitialized) return
  watchersInitialized = true
  _colorMode = colorMode

  watch(() => state.editContent, (newContent) => {
    if (!state.isEditing) return
    if (editRenderTimeout) clearTimeout(editRenderTimeout)
    editRenderTimeout = setTimeout(async () => {
      if (!state.isEditing) return
      if (!newContent) {
        state.html = ''
        state.toc = []
        return
      }
      const isDark = colorMode.value === 'dark'
      const result = await renderMarkdown(newContent, fileDir.value, isDark)
      if (state.isEditing) {
        state.html = result.html
        state.toc = result.toc
      }
    }, 300)
  })

  watch(() => colorMode.value, () => {
    if (state.isEditing && state.editContent) {
      if (editRenderTimeout) clearTimeout(editRenderTimeout)
      const isDark = colorMode.value === 'dark'
      renderMarkdown(state.editContent, fileDir.value, isDark).then((result) => {
        if (state.isEditing) {
          state.html = result.html
          state.toc = result.toc
        }
      })
    }
    else if (state.content) {
      render()
    }
  })
}

/**
 * Ask the backend to grant read/write access to a file the user chose, plus its
 * directory for relative images. Rejects if it is not an existing markdown file.
 */
function allowPath(path: string): Promise<void> {
  return invoke('allow_path', { path })
}

function clearEditTimeout() {
  if (editRenderTimeout) {
    clearTimeout(editRenderTimeout)
    editRenderTimeout = null
  }
}

export function useDocument() {
  const recentsStore = useRecentsStore()
  const colorMode = useColorMode()

  initWatchers(colorMode)

  const fileName = computed(() => {
    if (!state.currentPath) return null
    return state.currentPath.split(/[/\\]/).pop() || null
  })

  async function openWithDialog() {
    state.error = null

    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Markdown',
          extensions: [...VALID_MD_EXTENSIONS],
        },
      ],
    })

    if (!selected) {
      throw new Error('User cancelled')
    }

    await openPath(selected)
  }

  async function openPath(path: string) {
    state.error = null
    state.isLoading = true

    try {
      await allowPath(path)

      // Check file size before reading (skip if stat fails)
      try {
        const fileStat = await stat(path)
        if (fileStat.size > MAX_FILE_SIZE_BYTES) {
          const sizeMB = (fileStat.size / (1024 * 1024)).toFixed(1)
          state.error = `File is too large (${sizeMB} MB). Maximum supported size is ${MAX_FILE_SIZE_MB} MB.`
          throw new Error('File too large')
        }
      }
      catch (statErr) {
        // Re-throw file-too-large errors; otherwise let the read report the problem
        if (statErr instanceof Error && statErr.message === 'File too large') {
          throw statErr
        }
      }

      const content = await readTextFile(path)
      state.currentPath = path
      state.content = content
      // Leave edit mode so the previous file's edits can't be saved over this one
      state.isEditing = false
      state.editContent = ''
      state.isDirty = false
      recentsStore.addRecent(path)
      clearEditTimeout()
      await render()
    }
    catch (err) {
      if (!(err instanceof Error && err.message === 'File too large')) {
        state.error = `Failed to open file: ${err}`
      }
      // The error panel only shows outside edit mode. Callers already confirmed
      // discarding unsaved edits, so only a clean editor is left here.
      if (!state.isDirty) {
        clearEditTimeout()
        state.isEditing = false
        state.editContent = ''
      }
      throw err
    }
    finally {
      state.isLoading = false
    }
  }

  async function openDroppedFile(path: string) {
    // Validate extension using shared constants
    const ext = path.split('.').pop()?.toLowerCase()
    if (!VALID_MD_EXTENSIONS.includes(ext as typeof VALID_MD_EXTENSIONS[number])) {
      throw new Error('Only .md files are supported')
    }

    await openPath(path)
  }

  function clear() {
    state.currentPath = null
    state.content = ''
    state.html = ''
    state.toc = []
    state.error = null
    state.isEditing = false
    state.editContent = ''
    state.isDirty = false
  }

  function startEditing() {
    if (!state.currentPath) return
    state.editContent = state.content
    state.isEditing = true
    state.isDirty = false
  }

  async function stopEditing(skipConfirm = false): Promise<boolean> {
    if (state.isDirty && !skipConfirm) {
      const confirmed = window.confirm('You have unsaved changes. Discard them?')
      if (!confirmed) return false
    }
    clearEditTimeout()
    state.isEditing = false
    state.editContent = ''
    state.isDirty = false
    // Re-render from the saved content
    await render()
    return true
  }

  function updateEditContent(text: string) {
    state.editContent = text
    state.isDirty = true
  }

  async function saveFile() {
    if (!state.currentPath) return
    await writeTextFile(state.currentPath, state.editContent)
    state.content = state.editContent
    state.isDirty = false
    await render()
  }

  async function saveAs() {
    const selected = await save({
      filters: [
        {
          name: 'Markdown',
          extensions: [...VALID_MD_EXTENSIONS],
        },
      ],
    })

    if (!selected) return

    // The save dialog already granted write access to the chosen file
    await writeTextFile(selected, state.editContent)
    // Grant its directory for relative images; a non-markdown name keeps working without them
    await allowPath(selected).catch(() => {})
    state.currentPath = selected
    state.content = state.editContent
    state.isDirty = false
    recentsStore.addRecent(selected)
    await render()
  }

  /** Check for unsaved changes before navigating away. Returns true if safe to proceed. */
  async function confirmIfDirty(): Promise<boolean> {
    if (!state.isEditing || !state.isDirty) return true
    const confirmed = window.confirm('You have unsaved changes. Discard them?')
    if (confirmed) {
      state.isEditing = false
      state.editContent = ''
      state.isDirty = false
    }
    return confirmed
  }

  return {
    // State (readonly)
    currentPath: computed(() => state.currentPath),
    content: computed(() => state.content),
    html: computed(() => state.html),
    toc: computed(() => state.toc),
    error: computed(() => state.error),
    isLoading: computed(() => state.isLoading),
    isEditing: computed(() => state.isEditing),
    editContent: computed(() => state.editContent),
    isDirty: computed(() => state.isDirty),
    fileName,
    fileDir,

    // Actions
    openWithDialog,
    openPath,
    openDroppedFile,
    clear,
    render,
    startEditing,
    stopEditing,
    updateEditContent,
    saveFile,
    saveAs,
    confirmIfDirty,
  }
}
