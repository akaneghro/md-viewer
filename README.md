# MD Viewer

A cross-platform desktop Markdown document viewer built with Tauri v2 and Nuxt 4.

## Features

- **Open .md files** via native dialog (File > Open or Ctrl+O / Cmd+O)
- **Drag & Drop** support for .md files
- **Recent files** list (max 10, persisted in localStorage)
- **GitHub Flavored Markdown** (tables, task lists, strikethrough)
- **Syntax highlighting** with Shiki (30+ languages)
- **Table of Contents** sidebar (h1-h3)
- **Relative images** resolved from file directory
- **External links** open in system browser
- **Dark/Light theme** toggle
- **Security**: HTML sanitization, dangerous scheme blocking

## Requirements

- Node.js 18+
- pnpm
- Rust 1.87+

## Development

```bash
# Install dependencies
pnpm install

# Start development mode
pnpm run dev
```

## Build

```bash
# Build for production
pnpm run build
```

Executables will be generated in `src-tauri/target/release/bundle/`:
- Windows: `.msi`, `.exe`
- macOS: `.app`, `.dmg`
- Linux: `.AppImage`, `.deb`

## Project Structure

```
markdown-viewer/
├── app/                    # Nuxt frontend
│   ├── components/         # Vue components
│   ├── composables/        # Vue composables
│   ├── pages/              # Nuxt pages
│   ├── plugins/            # Nuxt plugins
│   ├── stores/             # Pinia stores
│   └── utils/              # Utilities (markdown rendering)
├── src-tauri/              # Tauri backend
│   ├── src/                # Rust source
│   ├── capabilities/       # Permissions
│   ├── icons/              # App icons
│   └── tauri.conf.json     # Tauri config
├── nuxt.config.ts          # Nuxt config
├── tailwind.config.ts      # Tailwind config
└── package.json
```

## Stack

- **Frontend**: Nuxt 3 (SPA mode), Vue 3, Tailwind CSS, Pinia
- **Backend**: Tauri v2 (Rust)
- **Markdown**: unified, remark-gfm, rehype-sanitize, Shiki

## License

MIT
