# MD Viewer

Cross-platform desktop Markdown (.md) viewer built with **Tauri v2 + Nuxt 4 (SPA)**.

## Stack

- **Desktop**: Tauri v2 (Rust backend)
- **Frontend**: Nuxt 4 in SPA mode (`ssr: false`), no SSR
- **State**: Pinia or composables + localStorage persistence
- **Styling**: Tailwind CSS (minimalist UI, no heavy component libraries)
- **Markdown**: remark/rehype pipeline (remark-gfm, rehype-sanitize, rehype-stringify)
- **Code highlighting**: Shiki (preferred) or rehype-highlight as fallback
- **Package manager**: pnpm

## Scripts

- `pnpm dev` → `tauri dev` (development)
- `pnpm build` → `tauri build` (generates installers/executables)

## Architecture

### Layout

Two-column layout:

- **Left sidebar**: Recent files list + Table of Contents (when a document is open)
- **Right panel**: Rendered Markdown preview
- **Top bar**: "Open..." button + current file name + dark mode toggle

### Tauri Backend (`src-tauri/`)

- `open_markdown_file()`: Opens native file dialog (`.md` filter), returns `{ path, content }`
- `read_file(path)`: Reads a file by path (for reopening recents)
- `start_watch(path)` _(optional)_: Emits events to frontend on file changes

### Frontend Components

| Component        | Responsibility                                                                  |
| ---------------- | ------------------------------------------------------------------------------- |
| `MarkdownViewer` | Renders sanitized HTML via `v-html`, intercepts `<a>` clicks for external links |
| `RecentFiles`    | Lists recent files, click to reopen                                             |
| `Toc`            | Lists h1-h3 headings, click to `scrollIntoView`                                 |

### Composable: `useDocument()`

- **State**: `currentPath`, `content`, `html`, `toc`, `error`
- **Actions**: `openWithDialog()`, `openPath(path)`, `openDroppedFile(path)`, `clearRecents()`
- Persists recents (no duplicates, max 10 entries)
- Renders markdown to HTML and extracts TOC on every open

### Markdown Pipeline (`/utils/markdown.ts`)

```
renderMarkdownToHtml(markdown, fileDir): { html, toc }
```

- **Plugins**: remark-gfm, heading IDs/anchors, rehype-sanitize
- **Relative images**: Transform relative `src` → `convertFileSrc(join(fileDir, srcRel))`; keep absolute http(s) URLs untouched
- **Sanitization**: Allow standard markdown tags (code, pre, table, a, img, etc.)

## Features

1. **Open files**: Native dialog (Ctrl+O / Cmd+O) or File menu
2. **Drag & Drop**: Drop `.md` files onto the window; reject non-`.md` with a toast
3. **Recent files**: Max 10, persisted in localStorage, with "Clear recents" option
4. **TOC sidebar**: Extracted from h1-h3 headings with scroll-to-section
5. **Relative images**: Resolved via Tauri's `convertFileSrc` relative to the file's directory
6. **External links**: Opened in system browser via `shell.open`
7. **File watching** _(nice to have)_: Auto-refresh on disk changes, encapsulated behind a feature flag
8. **Dark mode**: Light by default, toggle in top bar

## Security Rules

- **Always** sanitize markdown HTML output with rehype-sanitize
- **Block** `javascript:` and other dangerous URI schemes in links
- **Open** external links (`http`, `https`, `mailto`) with Tauri `shell.open`, never inside the WebView
- **Never** allow raw/unsanitized HTML injection

## Build & Packaging

### Tauri config (`src-tauri/tauri.conf.json`)

- `identifier`: `com.md.desk.viewer`
- `productName`: `"MD Viewer"`
- `version`: `0.1.0`
- `frontendDist`: `"../app/.output/public"`
- `devUrl`: `"http://localhost:3000"`

### Target bundles

| Platform | Formats             |
| -------- | ------------------- |
| Windows  | `.msi`, `.exe`      |
| macOS    | `.app`, `.dmg`      |
| Linux    | `.AppImage`, `.deb` |

### Icons

Provide PNGs in `src-tauri/icons/` at 512x512, 256x256, 128x128, 32x32.

## Git Workflow

### Branching Model

- **`main`** — always stable, represents the latest functional version. Never commit directly.
- **`feat/xxx`** — one branch per feature or task
- **`fix/xxx`** — one branch per bugfix

No `develop` or `staging` branches needed.

### Workflow for Claude

1. For every task, create a branch from `main` (`feat/short-name` or `fix/short-name`)
2. Work there with granular conventional commits
3. Notify when ready; user decides to merge or review first
4. Delete the feature branch after merge

### Worktrees

Only use worktrees when working on parallel tasks simultaneously. Example:

```
git worktree add ../markdown-viewer-feat-x feat/feature-x
```

For sequential tasks, stay in the main working directory.

### Tags

Use semver tags (`v0.1.0`, `v0.2.0`, etc.) to mark release milestones.

## Conventions

- UI language: English
- App display name: **"MD Viewer"**
- Use `unknown` instead of `any` in TypeScript
- Follow conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- Run `pnpm run typecheck && pnpm run lint` before committing
