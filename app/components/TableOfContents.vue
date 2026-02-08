<template>
  <div v-if="document.toc.value.length > 0" class="p-3">
    <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
      Table of Contents
    </h2>

    <nav>
      <ul class="space-y-1">
        <li
          v-for="item in document.toc.value"
          :key="item.id"
          :style="{ paddingLeft: `${(item.level - 1) * 0.75}rem` }"
        >
          <a
            :href="`#${item.id}`"
            class="block px-2 py-1 text-sm rounded truncate transition-colors"
            :class="[
              activeHeadingId === item.id
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700',
              activeHeadingId !== item.id && {
                'text-gray-900 dark:text-gray-100': item.level === 1,
                'text-gray-700 dark:text-gray-300': item.level === 2,
                'text-gray-500 dark:text-gray-400': item.level === 3,
              },
            ]"
            :title="item.title"
            @click.prevent="scrollToHeading(item.id)"
          >
            {{ item.title }}
          </a>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script setup lang="ts">
const document = useDocument()
const activeHeadingId = ref<string>('')
let observer: IntersectionObserver | null = null

function scrollToHeading(id: string) {
  const element = window.document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function setupScrollSpy() {
  cleanupScrollSpy()

  if (document.toc.value.length === 0) return

  const headingElements = document.toc.value
    .map((item) => window.document.getElementById(item.id))
    .filter((el): el is HTMLElement => el !== null)

  if (headingElements.length === 0) return

  observer = new IntersectionObserver(
    (entries) => {
      // Find the topmost visible heading
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

      if (visible.length > 0) {
        activeHeadingId.value = visible[0].target.id
      }
    },
    {
      rootMargin: '-10% 0px -80% 0px',
      threshold: 0,
    },
  )

  for (const el of headingElements) {
    observer.observe(el)
  }
}

function cleanupScrollSpy() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

// Re-setup scroll spy when TOC changes (new document loaded)
watch(
  () => document.toc.value,
  () => {
    nextTick(() => setupScrollSpy())
  },
  { deep: true },
)

onMounted(() => {
  if (document.toc.value.length > 0) {
    nextTick(() => setupScrollSpy())
  }
})

onUnmounted(() => {
  cleanupScrollSpy()
})
</script>
