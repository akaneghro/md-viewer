<template>
  <div class="h-full flex flex-col overflow-hidden">
    <textarea
      ref="textareaRef"
      class="flex-1 w-full resize-none p-8 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm leading-relaxed outline-none border-none"
      :value="document.editContent.value"
      spellcheck="false"
      @input="onInput"
    />
  </div>
</template>

<script setup lang="ts">
const document = useDocument()
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  document.updateEditContent(target.value)
}

onMounted(() => {
  nextTick(() => {
    textareaRef.value?.focus()
  })
})
</script>
