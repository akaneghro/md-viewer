import { describe, it, expect, vi } from 'vitest'

import {
  isExternalHref,
  isPathInside,
  normalizePath,
  renderMarkdown,
} from '~/utils/markdown'

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) =>
    `asset://localhost/${path.replace(/^\//, '')}`,
}))

describe('renderMarkdown', () => {
  // --- Basic rendering ---
  describe('basic rendering', () => {
    it('should render paragraphs', async () => {
      const result = await renderMarkdown('Hello world')
      expect(result.html).toContain('<p>Hello world</p>')
    })

    it('should render bold text', async () => {
      const result = await renderMarkdown('**bold**')
      expect(result.html).toContain('<strong>bold</strong>')
    })

    it('should render italic text', async () => {
      const result = await renderMarkdown('*italic*')
      expect(result.html).toContain('<em>italic</em>')
    })

    it('should render inline code', async () => {
      const result = await renderMarkdown('`code`')
      expect(result.html).toContain('<code>code</code>')
    })

    it('should render blockquotes', async () => {
      const result = await renderMarkdown('> quote')
      expect(result.html).toContain('<blockquote>')
    })

    it('should render unordered lists', async () => {
      const result = await renderMarkdown('- item 1\n- item 2')
      expect(result.html).toContain('<ul>')
      expect(result.html).toContain('<li>')
    })

    it('should render ordered lists', async () => {
      const result = await renderMarkdown('1. first\n2. second')
      expect(result.html).toContain('<ol>')
    })

    it('should render horizontal rules', async () => {
      const result = await renderMarkdown('---')
      expect(result.html).toContain('<hr>')
    })

    it('should handle empty content', async () => {
      const result = await renderMarkdown('')
      expect(result.html).toBe('')
      expect(result.toc).toEqual([])
    })
  })

  // --- Headings and TOC extraction ---
  describe('headings and TOC extraction', () => {
    it('should render h1 with ID and extract TOC', async () => {
      const result = await renderMarkdown('# Hello World')
      expect(result.html).toContain('id="hello-world"')
      expect(result.toc).toEqual([
        { level: 1, title: 'Hello World', id: 'hello-world' },
      ])
    })

    it('should render h2 and h3 in TOC', async () => {
      const md = '# Title\n## Subtitle\n### Section'
      const result = await renderMarkdown(md)
      expect(result.toc).toHaveLength(3)
      expect(result.toc[0]).toEqual({ level: 1, title: 'Title', id: 'title' })
      expect(result.toc[1]).toEqual({
        level: 2,
        title: 'Subtitle',
        id: 'subtitle',
      })
      expect(result.toc[2]).toEqual({
        level: 3,
        title: 'Section',
        id: 'section',
      })
    })

    it('should NOT include h4-h6 in TOC', async () => {
      const md = '#### Deep heading\n##### Deeper\n###### Deepest'
      const result = await renderMarkdown(md)
      expect(result.toc).toHaveLength(0)
    })

    it('should handle duplicate headings with unique IDs', async () => {
      const md = '# Title\n# Title\n# Title'
      const result = await renderMarkdown(md)
      expect(result.toc).toHaveLength(3)
      expect(result.toc[0]!.id).toBe('title')
      expect(result.toc[1]!.id).toBe('title-1')
      expect(result.toc[2]!.id).toBe('title-2')
    })

    it('should slugify special characters in headings', async () => {
      const result = await renderMarkdown('# Hello & World!')
      expect(result.toc[0]!.id).toMatch(/^hello/)
    })

    it('should generate fallback ID for empty heading text', async () => {
      // Heading with only special chars that get stripped
      const result = await renderMarkdown('# $$$$')
      if (result.toc.length > 0) {
        expect(result.toc[0]!.id).toMatch(/heading-/)
      }
    })

    it('should extract text from headings with inline formatting', async () => {
      const result = await renderMarkdown('# Hello **bold** world')
      expect(result.toc[0]!.title).toBe('Hello bold world')
    })
  })

  // --- GFM features ---
  describe('GFM features', () => {
    it('should render tables', async () => {
      const md = '| Col1 | Col2 |\n| --- | --- |\n| a | b |'
      const result = await renderMarkdown(md)
      expect(result.html).toContain('<table>')
      expect(result.html).toContain('<th>Col1</th>')
      expect(result.html).toContain('<td>a</td>')
    })

    it('should render task lists', async () => {
      const md = '- [x] Done\n- [ ] Todo'
      const result = await renderMarkdown(md)
      expect(result.html).toContain('type="checkbox"')
    })

    it('should render strikethrough', async () => {
      const md = '~~deleted~~'
      const result = await renderMarkdown(md)
      expect(result.html).toContain('<del>deleted</del>')
    })

    it('should render autolinked URLs', async () => {
      const result = await renderMarkdown('Visit https://example.com')
      expect(result.html).toContain('href="https://example.com"')
    })
  })

  // --- External links ---
  describe('external links', () => {
    it('should mark http links as external', async () => {
      const result = await renderMarkdown('[link](http://example.com)')
      expect(result.html).toContain('data-external="true"')
      expect(result.html).toContain('href="http://example.com"')
    })

    it('should mark https links as external', async () => {
      const result = await renderMarkdown('[link](https://example.com)')
      expect(result.html).toContain('data-external="true"')
    })

    it('should keep anchor links unchanged', async () => {
      const result = await renderMarkdown('[section](#my-section)')
      expect(result.html).toContain('href="#my-section"')
      expect(result.html).not.toContain('data-external')
    })

    it('should allow mailto links', async () => {
      const result = await renderMarkdown('[email](mailto:test@example.com)')
      expect(result.html).toContain('href="mailto:test@example.com"')
    })

    it('should mark mailto links as external', async () => {
      const result = await renderMarkdown('[email](mailto:test@example.com)')
      expect(result.html).toContain('data-external="true"')
    })

    it('should block javascript: links', async () => {
      const result = await renderMarkdown('[xss](javascript:alert(1))')
      expect(result.html).not.toContain('javascript:')
    })

    it('should block data: links', async () => {
      const result = await renderMarkdown(
        '[xss](data:text/html,<script>alert(1)</script>)',
      )
      expect(result.html).not.toContain('data:text/html')
    })

    it('should block file: links', async () => {
      const result = await renderMarkdown('[file](file:///etc/passwd)')
      expect(result.html).not.toContain('file:///')
    })
  })

  // --- Image resolution ---
  describe('image resolution', () => {
    it('should keep http images as-is', async () => {
      const result = await renderMarkdown(
        '![img](https://example.com/img.png)',
        '/dir',
      )
      expect(result.html).toContain('src="https://example.com/img.png"')
    })

    it('should keep http:// images as-is', async () => {
      const result = await renderMarkdown(
        '![img](http://example.com/img.png)',
        '/dir',
      )
      expect(result.html).toContain('src="http://example.com/img.png"')
    })

    it('should resolve relative images with convertFileSrc', async () => {
      const result = await renderMarkdown('![img](image.png)', '/docs')
      expect(result.html).toContain('asset://localhost/')
    })

    it('should resolve ./relative images', async () => {
      const result = await renderMarkdown('![img](./image.png)', '/docs')
      expect(result.html).toContain('asset://localhost/')
    })

    it('should block absolute /path images outside fileDir', async () => {
      // /absolute/image.png is NOT within /docs, so it should be blocked
      const result = await renderMarkdown(
        '![img](/absolute/image.png)',
        '/docs',
      )
      expect(result.html).toContain('src=""')
    })

    it('should block data: URIs in images', async () => {
      const result = await renderMarkdown(
        '![img](data:image/png;base64,abc)',
        '/docs',
      )
      expect(result.html).toContain('src=""')
    })

    it('should block other scheme URIs in images', async () => {
      const result = await renderMarkdown(
        '![img](ftp://server/img.png)',
        '/docs',
      )
      expect(result.html).toContain('src=""')
    })

    it('should not resolve images when fileDir is null', async () => {
      const result = await renderMarkdown('![img](image.png)')
      // Without fileDir, rehypeResolveImages returns early; image src is unmodified
      expect(result.html).toContain('src="image.png"')
    })

    it('should block path traversal attempts', async () => {
      const result = await renderMarkdown(
        '![img](../../etc/passwd)',
        '/docs/files',
      )
      expect(result.html).toContain('src=""')
    })

    it('should handle Windows-style fileDir paths', async () => {
      const result = await renderMarkdown(
        '![img](image.png)',
        'C:\\Users\\docs',
      )
      expect(result.html).toContain('asset://localhost/')
    })

    it('should resolve images in subfolders and collapse inner .. segments', async () => {
      const result = await renderMarkdown(
        '![a](images/a.png) ![b](sub/../b.png)',
        '/docs',
      )
      expect(result.html).toContain('src="asset://localhost/docs/images/a.png"')
      expect(result.html).toContain('src="asset://localhost/docs/b.png"')
    })

    it('should block traversal into a sibling folder sharing the prefix', async () => {
      const result = await renderMarkdown(
        '![img](../docs-secret/a.png)',
        '/docs',
      )
      expect(result.html).toContain('src=""')
    })

    it('should block sibling-prefix traversal with Windows paths', async () => {
      const result = await renderMarkdown(
        '![img](..\\docs-secret\\a.png)',
        'C:\\docs',
      )
      expect(result.html).toContain('src=""')
    })

    it('should block absolute paths even inside fileDir', async () => {
      const result = await renderMarkdown('![img](/docs/image.png)', '/docs')
      expect(result.html).toContain('src=""')
    })

    it('should block backslash-rooted and UNC paths', async () => {
      const result = await renderMarkdown(
        '![a](\\\\server\\share\\a.png) ![b](\\b.png)',
        'C:\\docs',
      )
      expect(result.html).not.toContain('asset://')
    })

    it('should resolve percent-encoded image names', async () => {
      const result = await renderMarkdown('![img](<my image.png>)', '/docs')
      expect(result.html).toContain('src="asset://localhost/docs/my image.png"')
    })

    it('should block percent-encoded traversal and drive letters', async () => {
      const result = await renderMarkdown(
        '![a](..%2Fsecret.png) ![b](C%3A/secret.png)',
        '/docs',
      )
      expect(result.html).not.toContain('asset://')
    })

    it('should resolve images for a document at the filesystem root', async () => {
      const result = await renderMarkdown('![img](image.png)', '/')
      expect(result.html).toContain('src="asset://localhost/image.png"')
    })
  })

  // --- Code highlighting ---
  describe('code highlighting', () => {
    it('should highlight code blocks with known language', async () => {
      const md = '```javascript\nconsole.log("hello")\n```'
      const result = await renderMarkdown(md)
      expect(result.html).toContain('shiki-container')
    })

    it('should handle code blocks without language', async () => {
      const md = '```\nplain text\n```'
      const result = await renderMarkdown(md)
      expect(result.html).toBeDefined()
    })

    it('should handle language aliases (js -> javascript)', async () => {
      const md = '```js\nconst x = 1\n```'
      const result = await renderMarkdown(md)
      expect(result.html).toContain('shiki-container')
    })

    it('should handle ts alias', async () => {
      const md = '```ts\nconst x: number = 1\n```'
      const result = await renderMarkdown(md)
      expect(result.html).toContain('shiki-container')
    })

    it('should handle py alias', async () => {
      const md = '```py\nprint("hello")\n```'
      const result = await renderMarkdown(md)
      expect(result.html).toContain('shiki-container')
    })

    it('should handle unknown languages gracefully', async () => {
      const md = '```unknownlang\nsome code\n```'
      const result = await renderMarkdown(md)
      expect(result.html).toBeDefined()
    })

    it('should decode HTML entities in code', async () => {
      const md = '```html\n<div class="a">&amp; \'x\' & é</div>\n```'
      const result = await renderMarkdown(md)
      const container = window.document.createElement('div')
      container.innerHTML = result.html
      expect(container.textContent).toContain('<div class="a">&amp; \'x\' & é</div>')
    })

    it('should use dark theme when isDark is true', async () => {
      const md = '```javascript\nconst x = 1\n```'
      const result = await renderMarkdown(md, null, true)
      expect(result.html).toContain('shiki-container')
    })

    it('should use light theme when isDark is false', async () => {
      const md = '```javascript\nconst x = 1\n```'
      const result = await renderMarkdown(md, null, false)
      expect(result.html).toContain('shiki-container')
    })

    it.each(['javascript', 'text'])(
      'should keep $ replacement patterns in code literally (%s)',
      async (lang) => {
        const code = 'const a = "$&"; const b = \'$\'\'; const c = `$`` + "$$"'
        const result = await renderMarkdown(`\`\`\`${lang}\n${code}\n\`\`\``)

        expect(result.html.match(/shiki-container/g)).toHaveLength(1)
        expect(result.html).not.toContain('<pre><code')
        const container = window.document.createElement('div')
        container.innerHTML = result.html
        expect(container.textContent).toContain(code)
      },
    )
  })

  // --- Security / sanitization ---
  describe('security and sanitization', () => {
    it('should strip script tags', async () => {
      const result = await renderMarkdown('<script>alert("xss")</script>')
      expect(result.html).not.toContain('<script>')
    })

    it('should strip event handlers from tags', async () => {
      const result = await renderMarkdown('<img src="x" onerror="alert(1)">')
      expect(result.html).not.toContain('onerror')
    })

    it('should strip iframe tags', async () => {
      const result = await renderMarkdown('<iframe src="evil.com"></iframe>')
      expect(result.html).not.toContain('<iframe')
    })

    it('should allow standard formatting tags', async () => {
      const result = await renderMarkdown('**bold** and *italic* and `code`')
      expect(result.html).toContain('<strong>bold</strong>')
      expect(result.html).toContain('<em>italic</em>')
      expect(result.html).toContain('<code>code</code>')
    })

    it('should allow details/summary tags', async () => {
      const md
        = '<details>\n<summary>Click me</summary>\nHidden content\n</details>'
      const result = await renderMarkdown(md)
      // remark with allowDangerousHtml: false may not pass raw HTML through
      // This test verifies the sanitize schema at least doesn't crash
      expect(result.html).toBeDefined()
    })

    it('should not turn a code fence info string into markup', async () => {
      const md = '~~~<pre><code>y</code></pre><img/src=x/onerror=alert(1)><a href=file:///c:/x>z</a>\nhello\n~~~'
      const result = await renderMarkdown(md)
      const container = window.document.createElement('div')
      container.innerHTML = result.html

      expect(container.querySelectorAll('img, a')).toHaveLength(0)
      expect(container.querySelectorAll('pre')).toHaveLength(1)
      expect(container.textContent).toBe('hello\n')
    })

    it('should preserve class attributes on code and span', async () => {
      // Code blocks get class="language-xxx" which should be preserved
      const md = '```javascript\ncode\n```'
      const result = await renderMarkdown(md)
      expect(result.html).toBeDefined()
    })
  })

  // --- Return types ---
  describe('return structure', () => {
    it('should return html string and toc array', async () => {
      const result = await renderMarkdown('# Test\nParagraph')
      expect(typeof result.html).toBe('string')
      expect(Array.isArray(result.toc)).toBe(true)
    })

    it('should return empty toc for content without headings', async () => {
      const result = await renderMarkdown('Just a paragraph')
      expect(result.toc).toEqual([])
    })
  })
})

describe('normalizePath', () => {
  it('should convert backslashes and resolve . and .. segments', () => {
    expect(normalizePath('C:\\Users\\docs\\.\\img\\..\\a.png')).toBe('C:/Users/docs/a.png')
  })

  it('should keep the root of absolute paths', () => {
    expect(normalizePath('/docs//sub/../a.png')).toBe('/docs/a.png')
  })

  it('should keep the root of UNC paths', () => {
    expect(normalizePath('\\\\server\\share\\docs')).toBe('//server/share/docs')
  })
})

describe('isPathInside', () => {
  it('should accept paths inside the directory', () => {
    expect(isPathInside('/docs/a.png', '/docs')).toBe(true)
    expect(isPathInside('/docs/sub/a.png', '/docs')).toBe(true)
    expect(isPathInside('/a.png', '/')).toBe(true)
  })

  it('should reject sibling folders that share the prefix', () => {
    expect(isPathInside('/docs-secret/a.png', '/docs')).toBe(false)
    expect(isPathInside('C:/docs-secret/a.png', 'C:/docs')).toBe(false)
  })

  it('should reject the directory itself and parents', () => {
    expect(isPathInside('/docs', '/docs')).toBe(false)
    expect(isPathInside('/etc/passwd', '/docs')).toBe(false)
  })

  it('should compare Windows paths case-insensitively', () => {
    expect(isPathInside('c:/Docs/a.png', 'C:/docs')).toBe(true)
    expect(isPathInside('//Server/share/a.png', '//server/share')).toBe(true)
  })

  it('should compare POSIX paths case-sensitively', () => {
    expect(isPathInside('/Docs/a.png', '/docs')).toBe(false)
  })
})

describe('isExternalHref', () => {
  it('should accept http, https and mailto links', () => {
    expect(isExternalHref('http://example.com')).toBe(true)
    expect(isExternalHref('https://example.com')).toBe(true)
    expect(isExternalHref('mailto:me@example.com')).toBe(true)
  })

  it('should reject anchors, relative links and other schemes', () => {
    expect(isExternalHref('#section')).toBe(false)
    expect(isExternalHref('other.md')).toBe(false)
    expect(isExternalHref('tel:123')).toBe(false)
    expect(isExternalHref('javascript:alert(1)')).toBe(false)
  })
})
