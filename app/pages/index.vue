<template>
  <div class="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <!-- Top Bar -->
    <TopBar />

    <!-- Main Content -->
    <div class="flex h-[calc(100vh-3.5rem)]">
      <!-- Sidebar (hidden during editing) -->
      <aside
        v-show="sidebarOpen && !document.isEditing.value"
        class="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden flex-shrink-0 sidebar"
      >
        <RecentFiles class="flex-shrink-0" />
        <TableOfContents class="flex-1 overflow-y-auto" />
      </aside>

      <!-- Sidebar Toggle (hidden during editing) -->
      <button
        v-if="!document.isEditing.value"
        class="absolute left-0 top-16 z-20 p-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        :class="{ 'left-64': sidebarOpen }"
        :title="sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'"
        @click="sidebarOpen = !sidebarOpen"
      >
        <svg class="w-4 h-4 text-gray-500 transition-transform" :class="{ 'rotate-180': !sidebarOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <!-- Edit Mode: Side-by-side layout -->
      <template v-if="document.isEditing.value">
        <!-- Editor Panel -->
        <div class="flex-1 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          <MarkdownEditor />
        </div>

        <!-- Preview Toggle -->
        <button
          class="absolute z-20 p-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          :class="previewOpen ? 'right-[50%]' : 'right-0'"
          style="top: 4.5rem;"
          :title="previewOpen ? 'Hide preview' : 'Show preview'"
          @click="previewOpen = !previewOpen"
        >
          <svg class="w-4 h-4 text-gray-500 transition-transform" :class="{ 'rotate-180': !previewOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <!-- Preview Panel -->
        <div
          v-show="previewOpen"
          class="w-1/2 overflow-y-auto flex-shrink-0"
        >
          <MarkdownViewer v-if="document.html.value" />
          <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">
            Start typing to see preview...
          </div>
        </div>
      </template>

      <!-- View Mode: Standard layout -->
      <main
        v-else
        class="flex-1 overflow-y-auto"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <div
          v-if="isDragging"
          class="absolute inset-0 bg-primary-500/20 border-2 border-dashed border-primary-500 flex items-center justify-center z-10"
        >
          <p class="text-primary-600 dark:text-primary-400 text-lg font-medium">
            Drop .md file here
          </p>
        </div>

        <div v-if="document.isLoading.value" class="flex items-center justify-center h-full">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
        </div>

        <div v-else-if="document.error.value" class="flex flex-col items-center justify-center h-full text-red-500 dark:text-red-400 px-8">
          <svg class="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-lg font-medium">Error</p>
          <p class="text-sm mt-2 text-center">{{ document.error.value }}</p>
        </div>

        <MarkdownViewer v-else-if="document.html.value" />

        <div v-else class="flex flex-col items-center justify-center h-full text-gray-400">
          <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-lg">No document open</p>
          <p class="text-sm mt-2">
            Press <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">Ctrl+O</kbd> to open a file
          </p>
          <p class="text-sm mt-1">or drag & drop a .md file</p>
        </div>
      </main>
    </div>

    <!-- Toast -->
    <Transition name="toast">
      <div
        v-if="toast.show"
        class="fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg"
        :class="toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'"
      >
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { isValidMarkdownFile } from '~/utils/constants'

const document = useDocument()
const isDragging = ref(false)
const sidebarOpen = ref(true)
const previewOpen = ref(true)

const toast = reactive({
  show: false,
  message: '',
  type: 'info' as 'info' | 'error',
})

function showToast(message: string, type: 'info' | 'error' = 'info') {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => {
    toast.show = false
  }, 3000)
}

/** Expose showToast so child components can use it via provide/inject */
provide('showToast', showToast)

function onDragOver(_e: DragEvent) {
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

async function onDrop(e: DragEvent) {
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const file = files[0]
  const path = (file as unknown as { path?: string }).path

  if (!path) {
    showToast('Could not get file path', 'error')
    return
  }

  if (!isValidMarkdownFile(path)) {
    showToast('Only .md files are supported', 'error')
    return
  }

  if (!await document.confirmIfDirty()) return

  try {
    await document.openPath(path)
  } catch (error) {
    if (error instanceof Error && error.message !== 'File too large') {
      showToast(`Failed to open file: ${error}`, 'error')
    }
  }
}

async function handleOpenError(error: unknown) {
  if (error instanceof Error && error.message === 'User cancelled') return
  showToast(`Failed to open file: ${error}`, 'error')
}

// Listen for menu events + check for CLI file argument
onMounted(async () => {
  // Check if a file was passed via CLI (e.g. double-click on .md file)
  try {
    const initialFile = await invoke<{ path: string; content: string } | null>('get_initial_file')
    if (initialFile) {
      await document.openWithContent(initialFile.path, initialFile.content)
    }
  } catch (error) {
    handleOpenError(error)
  }

  const unlisten = await listen('menu-open-file', async () => {
    try {
      if (!await document.confirmIfDirty()) return
      await document.openWithDialog()
    } catch (error) {
      handleOpenError(error)
    }
  })

  // Keyboard shortcuts
  const handleKeydown = async (e: KeyboardEvent) => {
    // Ctrl+O — Open file
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault()
      try {
        if (!await document.confirmIfDirty()) return
        await document.openWithDialog()
      } catch (error) {
        handleOpenError(error)
      }
      return
    }

    // Ctrl+S — Save (edit mode only)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
      if (document.isEditing.value) {
        e.preventDefault()
        try {
          await document.saveFile()
          showToast('File saved', 'info')
        } catch (error) {
          showToast(`Failed to save: ${error}`, 'error')
        }
      }
      return
    }

    // Ctrl+Shift+S — Save As (edit mode only)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      if (document.isEditing.value) {
        e.preventDefault()
        try {
          await document.saveAs()
          showToast('File saved', 'info')
        } catch (error) {
          if (error instanceof Error && error.message !== 'User cancelled') {
            showToast(`Failed to save: ${error}`, 'error')
          }
        }
      }
      return
    }

    // Escape — Stop editing
    if (e.key === 'Escape' && document.isEditing.value) {
      e.preventDefault()
      await document.stopEditing()
    }
  }
  window.addEventListener('keydown', handleKeydown)

  onUnmounted(() => {
    unlisten()
    window.removeEventListener('keydown', handleKeydown)
  })
})
</script>

<style>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(1rem);
}

/* Hide sidebar on narrow screens */
@media (max-width: 640px) {
  .sidebar {
    display: none;
  }
}
</style>
