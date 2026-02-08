<template>
  <div class="p-3 border-b border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between mb-2">
      <button
        class="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        @click="collapsed = !collapsed"
      >
        <svg
          class="w-3 h-3 transition-transform"
          :class="{ '-rotate-90': collapsed }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
        Recent Files
      </button>
      <button
        v-if="recentsStore.recentFiles.length > 0 && !collapsed"
        class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        @click="recentsStore.clearRecents"
      >
        Clear
      </button>
    </div>

    <template v-if="!collapsed">
      <div v-if="recentsStore.recentFiles.length === 0" class="text-sm text-gray-400 py-2">
        No recent files
      </div>

      <ul v-else class="space-y-1">
      <li
        v-for="file in recentsStore.recentFiles"
        :key="file.path"
        class="group"
      >
        <button
          class="w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm truncate flex items-center gap-2 transition-colors"
          :class="{ 'bg-primary-50 dark:bg-primary-900/20': file.path === document.currentPath.value }"
          :title="file.path"
          @click="handleOpen(file.path)"
        >
          <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="truncate">{{ file.name }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{{ parentFolder(file.path) }}</span>
        </button>
      </li>
    </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useRecentsStore } from '~/stores/recents'

const recentsStore = useRecentsStore()
const document = useDocument()
const collapsed = ref(false)
const showToast = inject<(message: string, type: 'info' | 'error') => void>('showToast')

function parentFolder(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : ''
}

async function handleOpen(path: string) {
  try {
    if (!await document.confirmIfDirty()) return
    await document.openPath(path)
  } catch (error) {
    const isFileTooLarge = error instanceof Error && error.message === 'File too large'
    if (!isFileTooLarge) {
      showToast?.('File no longer exists or cannot be read. Removed from recents.', 'error')
      recentsStore.removeRecent(path)
    } else {
      showToast?.(`${document.error.value}`, 'error')
    }
  }
}
</script>
