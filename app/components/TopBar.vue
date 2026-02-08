<template>
  <header class="h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center px-4 gap-4">
    <!-- Open Button -->
    <button
      class="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors"
      @click="handleOpen"
    >
      Open...
    </button>

    <!-- File Name -->
    <div class="flex-1 truncate flex items-center gap-1">
      <span v-if="document.fileName.value" class="text-sm font-medium" :title="document.currentPath.value ?? undefined">
        {{ document.fileName.value }}
      </span>
      <span v-if="document.isDirty.value" class="text-sm text-orange-500 font-bold" title="Unsaved changes">*</span>
      <span v-if="!document.fileName.value" class="text-sm text-gray-400">
        No file open
      </span>
    </div>

    <!-- Edit Mode Buttons -->
    <template v-if="document.fileName.value">
      <!-- View mode: Edit button -->
      <button
        v-if="!document.isEditing.value"
        class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
        title="Edit file"
        @click="document.startEditing()"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </button>

      <!-- Edit mode: Save, Save As, Cancel -->
      <template v-if="document.isEditing.value">
        <button
          class="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
          title="Save (Ctrl+S)"
          @click="handleSave"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save
        </button>
        <button
          class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium transition-colors"
          title="Save As... (Ctrl+Shift+S)"
          @click="handleSaveAs"
        >
          Save As...
        </button>
        <button
          class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium transition-colors"
          title="Cancel editing (Escape)"
          @click="handleCancel"
        >
          Cancel
        </button>
      </template>
    </template>

    <!-- Theme Toggle -->
    <ThemeToggle />
  </header>
</template>

<script setup lang="ts">
const document = useDocument()
const showToast = inject<(message: string, type: 'info' | 'error') => void>('showToast')

async function handleOpen() {
  try {
    if (!await document.confirmIfDirty()) return
    await document.openWithDialog()
  } catch (error) {
    if (error instanceof Error && error.message !== 'User cancelled') {
      console.error('Failed to open file:', error)
    }
  }
}

async function handleSave() {
  try {
    await document.saveFile()
    showToast?.('File saved', 'info')
  } catch (error) {
    showToast?.(`Failed to save: ${error}`, 'error')
  }
}

async function handleSaveAs() {
  try {
    await document.saveAs()
    showToast?.('File saved', 'info')
  } catch (error) {
    if (error instanceof Error && error.message !== 'User cancelled') {
      showToast?.(`Failed to save: ${error}`, 'error')
    }
  }
}

async function handleCancel() {
  await document.stopEditing()
}
</script>
