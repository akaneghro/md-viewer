<template>
  <article
    ref="containerRef"
    class="markdown-body p-8 max-w-4xl mx-auto"
    v-html="document.html.value"
    @click="handleClick"
  />
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-shell'

const document = useDocument()
const containerRef = ref<HTMLElement | null>(null)

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const anchor = target.closest('a')

  if (!anchor) return

  const href = anchor.getAttribute('href')
  if (!href) return

  // Check if external link
  if (anchor.dataset.external === 'true' || href.startsWith('http://') || href.startsWith('https://')) {
    event.preventDefault()
    open(href)
    return
  }

  // Handle internal anchors
  if (href.startsWith('#')) {
    event.preventDefault()
    const id = href.slice(1)
    const element = window.document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
}
</script>

<style>
/* GitHub-like markdown styling */
.markdown-body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  word-wrap: break-word;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body h1 {
  font-size: 2em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #d1d5db;
}

.dark .markdown-body h1 {
  border-bottom-color: #374151;
}

.markdown-body h2 {
  font-size: 1.5em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid #d1d5db;
}

.dark .markdown-body h2 {
  border-bottom-color: #374151;
}

.markdown-body h3 {
  font-size: 1.25em;
}

.markdown-body h4 {
  font-size: 1em;
}

.markdown-body h5 {
  font-size: 0.875em;
}

.markdown-body h6 {
  font-size: 0.85em;
  color: #6b7280;
}

.markdown-body p {
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body a {
  color: #0969da;
  text-decoration: none;
}

.dark .markdown-body a {
  color: #58a6ff;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body ul,
.markdown-body ol {
  margin-top: 0;
  margin-bottom: 16px;
  padding-left: 2em;
}

.markdown-body li {
  margin-top: 0.25em;
}

.markdown-body li + li {
  margin-top: 0.25em;
}

.markdown-body blockquote {
  margin: 0 0 16px 0;
  padding: 0 1em;
  color: #6b7280;
  border-left: 0.25em solid #d1d5db;
}

.dark .markdown-body blockquote {
  color: #9ca3af;
  border-left-color: #4b5563;
}

.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: #f3f4f6;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
}

.dark .markdown-body code {
  background-color: #374151;
}

.markdown-body pre {
  margin-top: 0;
  margin-bottom: 16px;
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 6px;
}

.dark .markdown-body pre {
  background-color: #1f2937;
}

.markdown-body pre code {
  padding: 0;
  margin: 0;
  font-size: 100%;
  background-color: transparent;
  border-radius: 0;
}

/* Shiki code blocks */
.markdown-body .shiki-container {
  margin-top: 0;
  margin-bottom: 16px;
  border-radius: 6px;
  overflow: hidden;
}

.markdown-body .shiki-container pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
}

.markdown-body .shiki-container code {
  padding: 0;
  background: transparent;
}

.markdown-body table {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow: auto;
  margin-top: 0;
  margin-bottom: 16px;
  border-spacing: 0;
  border-collapse: collapse;
}

.markdown-body table th,
.markdown-body table td {
  padding: 6px 13px;
  border: 1px solid #d1d5db;
}

.dark .markdown-body table th,
.dark .markdown-body table td {
  border-color: #4b5563;
}

.markdown-body table th {
  font-weight: 600;
  background-color: #f9fafb;
}

.dark .markdown-body table th {
  background-color: #374151;
}

.markdown-body table tr:nth-child(2n) {
  background-color: #f9fafb;
}

.dark .markdown-body table tr:nth-child(2n) {
  background-color: #1f2937;
}

.markdown-body hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #d1d5db;
  border: 0;
}

.dark .markdown-body hr {
  background-color: #4b5563;
}

.markdown-body img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}

/* Task lists */
.markdown-body input[type="checkbox"] {
  margin-right: 0.5em;
  vertical-align: middle;
}

.markdown-body li:has(> input[type="checkbox"]) {
  list-style-type: none;
  margin-left: -1.5em;
}

/* Strikethrough */
.markdown-body del {
  text-decoration: line-through;
  color: #6b7280;
}

.dark .markdown-body del {
  color: #9ca3af;
}
</style>
