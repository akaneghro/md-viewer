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
  return parts.join('/')
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
    } else if (state.content) {
      render()
    }
  })
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
      // Check file size before reading (skip if stat fails due to scope restrictions)
      try {
        const fileStat = await stat(path)
        if (fileStat.size > MAX_FILE_SIZE_BYTES) {
          const sizeMB = (fileStat.size / (1024 * 1024)).toFixed(1)
          state.error = `File is too large (${sizeMB} MB). Maximum supported size is ${MAX_FILE_SIZE_MB} MB.`
          throw new Error('File too large')
        }
      } catch (statErr) {
        // Re-throw file-too-large errors, but ignore stat permission/scope errors
        if (statErr instanceof Error && statErr.message === 'File too large') {
          throw statErr
        }
        // stat() may fail due to fs:scope restrictions; proceed with read attempt
      }

      const content = await readTextFile(path)
      state.currentPath = path
      state.content = content
      recentsStore.addRecent(path)
      clearEditTimeout()
      await render()
    } catch (err) {
      if (!(err instanceof Error && err.message === 'File too large')) {
        state.error = `Failed to open file: ${err}`
      }
      throw err
    } finally {
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

  /** Open a file with pre-read content (e.g. from Rust CLI handler, bypasses fs scope) */
  async function openWithContent(path: string, content: string) {
    state.error = null
    state.isLoading = true

    try {
      state.currentPath = path
      state.content = content
      recentsStore.addRecent(path)
      clearEditTimeout()
      await render()
    } catch (err) {
      state.error = `Failed to render markdown: ${err}`
      throw err
    } finally {
      state.isLoading = false
    }
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

    await writeTextFile(selected, state.editContent)
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
    openWithContent,
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
