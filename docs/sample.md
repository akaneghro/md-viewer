# MD Viewer Sample

A quick tour of what **MD Viewer** renders. Open this file in the app (or drop it
on the window) and use the table of contents on the left to jump around.

## Task lists

- [x] GitHub Flavored Markdown
- [x] Syntax highlighting with light and dark themes
- [x] Table of contents that follows your scroll
- [ ] Your next document

## Tables

| Shortcut               | Action              |
| ---------------------- | ------------------- |
| `Ctrl/Cmd + O`         | Open a file         |
| `Ctrl/Cmd + S`         | Save (edit mode)    |
| `Ctrl/Cmd + Shift + S` | Save As (edit mode) |
| `Esc`                  | Leave edit mode     |

## Code blocks

Fenced code blocks are highlighted with [Shiki](https://shiki.style):

```ts
export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-')
}
```

```rust
fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
}
```

```bash
pnpm install && pnpm dev
```

## Text formatting

You can use *italics*, **bold**, ~~strikethrough~~ and `inline code`.
Autolinks such as https://github.com/akaneghro/md-viewer work too, and
external links always open in your browser.

> Raw HTML is never rendered, so opening a Markdown file is always safe.

### Lists

1. Open a document
2. Press **Edit** to change it
3. Save with `Ctrl+S`

- Nested lists
  - work as
    - expected

## Images

Images next to the document (or in a subfolder) are loaded with relative paths
such as `![Diagram](images/diagram.png)`. Remote images are loaded over HTTPS:

![MD Viewer icon](https://raw.githubusercontent.com/akaneghro/md-viewer/main/src-tauri/icons/128x128.png)

---

Made with MD Viewer.
