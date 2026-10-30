import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { SKIP, visit } from 'unist-util-visit'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

export interface TocItem {
  level: number
  title: string
  id: string
}

export interface MarkdownResult {
  html: string
  toc: TocItem[]
}

// Custom sanitize schema that allows more elements for markdown
const sanitizeSchema = {
  ...defaultSchema,
  clobber: [], // Don't prefix id attributes — we generate them ourselves from heading text
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src || []), 'asset'],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'input', // For tasklists
    'details',
    'summary',
  ],
  attributes: {
    ...defaultSchema.attributes,
    'a': [...(defaultSchema.attributes?.a || []), 'data-external'],
    'input': ['type', 'checked', 'disabled'],
    'code': [...(defaultSchema.attributes?.code || []), 'className'],
    'span': [...(defaultSchema.attributes?.span || []), 'className', 'style'],
    'pre': [...(defaultSchema.attributes?.pre || []), 'className', 'style'],
    '*': ['id', 'className'],
  },
}

// Generate slug from text
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Extract text from heading node
function extractText(node: Element): string {
  let text = ''
  visit(node, 'text', (textNode: { value: string }) => {
    text += textNode.value
  })
  return text
}

// Plugin to add IDs to headings and extract TOC
function rehypeHeadingIds(toc: TocItem[]): Plugin<[], Root> {
  const usedIds = new Set<string>()

  return () => (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const match = node.tagName.match(/^h([1-6])$/)
      if (match) {
        const level = parseInt(match[1]!, 10)
        if (level <= 3) {
          const title = extractText(node)
          let id = slugify(title) || `heading-${usedIds.size}`

          // Ensure unique ID
          let counter = 1
          const baseId = id
          while (usedIds.has(id)) {
            id = `${baseId}-${counter}`
            counter++
          }
          usedIds.add(id)

          // Add ID to heading
          node.properties = node.properties || {}
          node.properties.id = id

          // Add to TOC
          toc.push({ level, title, id })
        }
      }
    })
  }
}

/** Schemes opened with the system browser / mail client instead of the WebView */
export function isExternalHref(href: string): boolean {
  return href.startsWith('http://')
    || href.startsWith('https://')
    || href.startsWith('mailto:')
}

// Normalize a path to forward slashes, resolving . and .. segments
export function normalizePath(path: string): string {
  const slashed = path.replace(/\\/g, '/')
  const parts = slashed.split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') {
      resolved.pop()
    }
    else {
      resolved.push(part)
    }
  }
  // Preserve the root of absolute and UNC (//server/share) paths
  const prefix = slashed.startsWith('//') ? '//' : slashed.startsWith('/') ? '/' : ''
  return prefix + resolved.join('/')
}

// Windows paths (drive letter or UNC) are case-insensitive
function isWindowsPath(path: string): boolean {
  return /^[a-z]:/i.test(path) || path.startsWith('//')
}

/** Whether `path` is inside `dir` (both normalized with `normalizePath`) */
export function isPathInside(path: string, dir: string): boolean {
  const base = dir.endsWith('/') ? dir : `${dir}/`
  if (isWindowsPath(dir)) {
    return path.toLowerCase().startsWith(base.toLowerCase())
  }
  return path.startsWith(base)
}

function safeDecodeUri(uri: string): string {
  try {
    return decodeURIComponent(uri)
  }
  catch {
    return uri
  }
}

// Plugin to resolve relative image paths
function rehypeResolveImages(fileDir: string | null): Plugin<[], Root> {
  return () => (tree: Root) => {
    if (!fileDir) return

    const normalizedDir = normalizePath(fileDir.replace(/\\/g, '/'))

    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img' && node.properties?.src) {
        const src = String(node.properties.src)

        // Only allow http(s) URLs for remote images
        if (src.startsWith('http://') || src.startsWith('https://')) {
          return
        }

        // Work on the real file path: micromark percent-encodes spaces, backslashes, etc.
        const relativePath = safeDecodeUri(src)

        // Block data: URIs, other schemes and drive letters in images
        if (relativePath.includes(':')) {
          node.properties.src = ''
          return
        }

        // Block absolute paths: only images next to the document are allowed
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
          node.properties.src = ''
          return
        }

        // Resolve relative to the document, normalizing any . and .. segments
        const separator = normalizedDir.endsWith('/') ? '' : '/'
        const absolutePath = normalizePath(`${normalizedDir}${separator}${relativePath}`)

        // Validate: resolved path must stay within the file's directory
        if (!isPathInside(absolutePath, normalizedDir)) {
          node.properties.src = ''
          return
        }

        // Convert to asset URL for Tauri
        node.properties.src = convertFileSrc(absolutePath)
      }
    })
  }
}

// Plugin to add target="_blank" to external links and handle dangerous schemes
const rehypeExternalLinks: Plugin<[], Root> = () => (tree: Root) => {
  visit(tree, 'element', (node: Element) => {
    if (node.tagName === 'a' && node.properties?.href) {
      const href = String(node.properties.href)

      // Whitelist: only allow safe schemes and internal anchors
      if (!isExternalHref(href) && !href.startsWith('#')) {
        node.properties.href = '#'
        return
      }

      // Mark external links
      if (isExternalHref(href)) {
        node.properties['data-external'] = 'true'
      }
    }
  })
}

let shikiHighlighter: Awaited<
  ReturnType<typeof import('shiki').createHighlighter>
> | null = null

async function getHighlighter() {
  if (!shikiHighlighter) {
    const { createHighlighter } = await import('shiki')
    shikiHighlighter = await createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: [
        'javascript',
        'typescript',
        'python',
        'rust',
        'go',
        'java',
        'c',
        'cpp',
        'csharp',
        'php',
        'ruby',
        'swift',
        'kotlin',
        'json',
        'yaml',
        'xml',
        'html',
        'css',
        'scss',
        'sql',
        'bash',
        'shell',
        'powershell',
        'markdown',
        'dockerfile',
        'graphql',
        'vue',
        'jsx',
        'tsx',
      ],
    })
  }
  return shikiHighlighter
}

const LANG_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  zsh: 'bash',
  yml: 'yaml',
}

type Highlighter = Awaited<ReturnType<typeof getHighlighter>>

// Language from a code block's `language-xxx` class, or 'text'
function codeLanguage(code: Element): string {
  const classes = code.properties?.className
  const languageClass = (Array.isArray(classes) ? classes : [])
    .map(String)
    .find(name => name.startsWith('language-'))
  return languageClass?.slice('language-'.length) || 'text'
}

// Plugin to highlight code blocks with Shiki. It runs on the sanitized tree, so neither
// the code nor its fence info string is ever parsed as markup.
function rehypeHighlightCode(highlighter: Highlighter, isDark: boolean): Plugin<[], Root> {
  const theme = isDark ? 'github-dark' : 'github-light'
  const loadedLangs = highlighter.getLoadedLanguages()

  return () => (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      const code = node.children[0]
      if (
        node.tagName !== 'pre'
        || node.children.length !== 1
        || code?.type !== 'element'
        || code.tagName !== 'code'
        || !parent
        || index === undefined
      ) {
        return
      }

      const requested = codeLanguage(code)
      const alias = LANG_ALIASES[requested] || requested
      const lang = loadedLangs.includes(alias as never) ? alias : 'text'

      try {
        const highlighted = highlighter.codeToHast(extractText(code), { lang, theme })
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['shiki-container'] },
          children: highlighted.children.filter(child => child.type === 'element'),
        }
        return SKIP
      }
      catch {
        // Keep the plain code block if highlighting fails
      }
    })
  }
}

export async function renderMarkdown(
  content: string,
  fileDir: string | null = null,
  isDark: boolean = false,
): Promise<MarkdownResult> {
  const toc: TocItem[] = []
  const highlighter = await getHighlighter()

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeHeadingIds(toc))
    .use(rehypeResolveImages(fileDir))
    .use(rehypeExternalLinks)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeHighlightCode(highlighter, isDark))
    .use(rehypeStringify)

  const result = await processor.process(content)

  return {
    html: String(result),
    toc,
  }
}
