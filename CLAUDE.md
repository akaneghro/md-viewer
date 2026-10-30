# MD Viewer

Cross-platform desktop Markdown viewer and editor built with **Tauri 2 + Nuxt 4 (SPA)**.
Public repo: <https://github.com/akaneghro/md-viewer> (MIT).

## Stack

- **Desktop**: Tauri 2 (Rust, edition 2021, MSRV 1.90). Plugins: `single-instance`, `dialog`, `fs`, `opener`
- **Frontend**: Nuxt 4 in SPA mode (`ssr: false`), source in `app/`, Vue 3 `<script setup>` + TypeScript (strict)
- **State**: module-level reactive state in composables (`useDocument`, `useColorMode`) + Pinia store for recents
  (persisted with `pinia-plugin-persistedstate`)
- **Styling**: Tailwind CSS 4 via `@tailwindcss/vite`, CSS-first config in `app/assets/css/main.css`
  (`primary-*` palette, class-based `dark` variant). No component libraries
- **Markdown**: unified (remark-parse, remark-gfm, remark-rehype, rehype-sanitize, rehype-stringify) + Shiki
- **Tooling**: pnpm 10 (pinned in `packageManager`), Node 22+, ESLint (`@nuxt/eslint`, stylistic), vue-tsc, Vitest + happy-dom

## Scripts

| Script | Does |
| --- | --- |
| `pnpm dev` | `tauri dev` (starts `pnpm nuxt:dev` on port 3000 + the app window) |
| `pnpm build` | `tauri build` (runs `pnpm generate`, then bundles installers) |
| `pnpm generate` | Static Nuxt build into `.output/public` (Tauri `frontendDist`) |
| `pnpm nuxt:dev` | Frontend only. Tauri APIs are unavailable in a plain browser |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm typecheck` | `nuxt typecheck` (vue-tsc) |
| `pnpm test` / `test:watch` / `test:coverage` | Vitest (`app/**/__tests__/**/*.test.ts`, 80% coverage thresholds) |
| `cargo test` / `cargo clippy --all-targets -- -D warnings` | Rust checks, run in `src-tauri/` (needs `.output/public` to exist) |

## Architecture

### Layout (`app/pages/index.vue`)

- **Top bar** (`TopBar`): Open..., file name + dirty marker, Edit / Save / Save As / Cancel, theme toggle
- **Sidebar**: `RecentFiles` + `TableOfContents` (hidden while editing, collapsible)
- **Main**: `MarkdownViewer`, or `MarkdownEditor` + preview side by side in edit mode
- Global keyboard shortcuts, toast, drop overlay and Tauri event listeners live in the page

### Tauri backend (`src-tauri/src/lib.rs`)

- `allow_path(path)` command: validates an existing, absolute markdown file and grants fs access to it
  plus asset-protocol access to its directory (relative images). Called before every open
- `get_initial_file()` command: returns the file passed on launch (CLI arg / file association), if any,
  and marks the frontend as ready for `open-file` events
- `open-file` event: emitted when the OS asks the running instance to open a file
  (single-instance second launch, macOS `RunEvent::Opened`); queued until the frontend is ready
- `menu-open-file` event: native File > Open... (`CmdOrCtrl+O`)
- `single-instance` must stay the first plugin registered

### Capabilities (`src-tauri/capabilities/main.json`)

Minimal and explicit: `core:default` + window basics, `dialog` open/save, `fs:allow-read-text-file`,
`fs:allow-write-text-file`, `fs:allow-stat`, and `opener:allow-open-url` for `http`, `https` and `mailto`.
There are no static fs or asset scopes; paths are granted at runtime (`allow_path`, dialog plugin).
Add a permission only when a feature needs it.

### Frontend

| Unit | Responsibility |
| --- | --- |
| `useDocument` | Open (dialog, path, drop), edit/save/save-as, dirty check, render on change and theme switch |
| `useColorMode` | Light/dark, initial value from system preference, persisted in localStorage |
| `useDragDrop` | Native Tauri drag & drop (`onDragDropEvent`), accepts the first markdown path |
| `stores/recents` | Max 10 recent files, deduplicated, persisted |
| `utils/markdown` | `renderMarkdown(content, fileDir, isDark)` → `{ html, toc }` |
| `utils/constants` | Valid extensions (`md`, `markdown`, `mdown`, `mkd`), 10 MB size limit |

### Markdown pipeline (`app/utils/markdown.ts`)

- remark-gfm → rehype with `allowDangerousHtml: false` → heading IDs + TOC (h1–h3) → image resolution →
  link filtering → rehype-sanitize (custom schema) → stringify → Shiki post-processing
  (`github-light` / `github-dark`)
- Relative images are resolved against the document directory, must stay inside it, and go through
  `convertFileSrc`. Absolute paths, `data:` and other schemes are blocked; `http(s)` URLs are kept
- Links: only `http`, `https`, `mailto` (opened with `openUrl`) and `#anchors`; anything else becomes `#`

## Security rules

- **Always** sanitize rendered HTML with rehype-sanitize; never enable raw HTML
- **Never** add global `**` fs or asset scopes back; grant paths at runtime only
- External links open with the opener plugin, never inside the WebView
- `withGlobalTauri` stays off: import from `@tauri-apps/api` / plugins, never `window.__TAURI__`
- CSP `img-src` allows `https:` remote images only (plain `http:` is blocked)

## Build & release

- `identifier`: `io.github.akaneghro.mdviewer`, `productName`: `MD Viewer`
- Version `0.2.0`: keep `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` in sync,
  and add an entry to `CHANGELOG.md` (Keep a Changelog)
- Bundles (`targets: all`): Windows `.msi` + NSIS `.exe` (hooks in `src-tauri/nsis/hooks.nsh` set the
  `MDViewer.Markdown` file icon), macOS `.app`/`.dmg`, Linux `.AppImage`/`.deb`/`.rpm`
- CI (`.github/workflows/ci.yml`): lint, typecheck, test, and clippy on pushes and PRs to `main`
- Release (`.github/workflows/release.yml`): pushing a `v*` tag builds all platforms with `tauri-action`
  (macOS universal) and creates a **draft** release to review and publish by hand
- Builds are unsigned; README documents the SmartScreen / Gatekeeper workarounds

## Git workflow

- **`main`** is always stable and protected by convention: **never commit to `main` directly**
- One branch per task from `main`: `feat/short-name`, `fix/short-name`, `docs/...`, `chore/...`
- Granular conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `refactor:`, `test:`, `build:`)
- Open a pull request to `main`; CI must be green. The user decides when to merge
- Delete the branch after merge. Tag releases on `main` with `vX.Y.Z`
- Use worktrees only for parallel tasks (`git worktree add ../markdown-viewer-feat-x feat/feature-x`)

## Conventions

- UI language: English; app display name **"MD Viewer"**
- Use `unknown` instead of `any` in TypeScript (`no-explicit-any` is an error)
- Run `pnpm lint && pnpm typecheck && pnpm test` before committing; `cargo clippy` for Rust changes
- Keep tests next to the code in `__tests__/` folders
