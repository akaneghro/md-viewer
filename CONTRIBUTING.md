# Contributing

Thanks for helping improve MD Viewer! Bug reports, ideas and pull requests are all welcome.

## Reporting bugs and ideas

Use the [issue templates](https://github.com/akaneghro/md-viewer/issues/new/choose). For bugs, include
your OS, the MD Viewer version and, if possible, a small Markdown file that shows the problem.
Report security issues privately as described in [SECURITY.md](SECURITY.md).

## Development setup

You need Node.js 22+, pnpm 10, Rust stable and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
pnpm install
pnpm dev
```

## Pull requests

1. Create a branch from `main` (`feat/short-name`, `fix/short-name`, `docs/...`).
2. Keep the change focused. Add or update tests in the nearest `__tests__/` folder when you change logic.
3. Make sure the checks pass:

   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
   ```

4. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`...).
5. Open a pull request against `main` and fill in the template. Add user-facing changes to the
   `Unreleased` section of [CHANGELOG.md](CHANGELOG.md).

## Guidelines

- TypeScript is strict: use `unknown` instead of `any`.
- Keep the UI minimal and in English, and use Tailwind utilities instead of component libraries.
- Never render raw HTML or widen the Tauri file-system scopes or capabilities without a good reason.
  The security rules are listed in [CLAUDE.md](CLAUDE.md#security-rules).

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
