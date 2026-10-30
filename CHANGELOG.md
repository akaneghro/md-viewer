# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-30

### Added

- Single instance: opening another Markdown file while the app is running focuses the
  existing window and opens the file there.
- macOS "Open With" / double-click support (files delivered through `RunEvent::Opened`).
- Remote images over HTTPS are now displayed.
- Release workflow that builds and publishes installers for Windows (`.msi`, `.exe`),
  macOS (universal `.dmg`) and Linux (`.AppImage`, `.deb`, `.rpm`).
- CI for lint, typecheck, unit tests and `cargo clippy`.
- App metadata (publisher, license, description), MIT `LICENSE`, sample document,
  screenshots and contributor docs.

### Changed

- Upgraded to Nuxt 4, Tailwind CSS 4, Pinia 4, Shiki 4, Vitest 5, TypeScript 6 and
  Tauri 2.12. Building from source now needs Node.js 22.22.3+ (or 24.15+) and Rust 1.90+.
- Replaced the deprecated Tauri shell plugin with the opener plugin for external links.
- New app identifier `io.github.akaneghro.mdviewer`. Recent files and the theme
  choice from 0.1.0 are not carried over.
- The Windows `-setup.exe` (NSIS) installer registers `.md` files under its own ProgID
  (`MDViewer.Markdown`) with a dedicated document icon, and uninstalling removes it.
  The `.msi` uses the bundler's default ProgID and the app icon.

### Fixed

- Drag & drop now works. It uses Tauri's native drag & drop events.
- The table of contents now highlights the current section after opening a file.
- Code blocks containing `$&`, `$'` or `&` / `<` are no longer mangled or shown escaped.
- Images whose names contain spaces or other encoded characters now load.
- Opening another file while editing leaves edit mode, so stale edits can't be saved over it.
- Relative launch arguments are resolved against the working directory.
- Lists show their bullets and numbers.
- On macOS the menu bar has the app and Edit menus, so copy, paste, cut, undo and
  select all work in the editor.
- Opening a file that can't be shown while editing (for example, one over 10 MB) now
  shows the error instead of doing nothing.

### Security

- Removed the global (`**`) file system and asset scopes. The app can only access files
  you open or save, plus images in the document's folder.
- Image paths are checked so they can't escape the document's folder (including
  `C:/docs` vs `C:/docs-secret` and case-insensitive Windows paths), and absolute
  image paths are blocked.
- External links are limited to `http`, `https` and `mailto`, and all of them open outside
  the app (browser or mail client).
- A code block's language tag can no longer inject HTML into the rendered document
  (highlighting now runs on the sanitized tree).
- Plain `http://` images are dropped by the renderer; remote images load over HTTPS only.
- `withGlobalTauri` is disabled.

## [0.1.0] - 2026-02-08

### Added

- First release of MD Viewer, a desktop Markdown viewer built with Tauri 2 and Nuxt.
- GitHub Flavored Markdown rendering with sanitized output.
- Syntax highlighting with Shiki (light and dark themes).
- Table of contents sidebar for `h1`–`h3` headings.
- Recent files list, open dialog and `Ctrl/Cmd+O` shortcut, native File menu.
- Edit mode with live preview, Save and Save As.
- Dark mode toggle.
- File associations for `.md`, `.markdown`, `.mdown` and `.mkd`.

[Unreleased]: https://github.com/akaneghro/md-viewer/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/akaneghro/md-viewer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/akaneghro/md-viewer/releases/tag/v0.1.0
