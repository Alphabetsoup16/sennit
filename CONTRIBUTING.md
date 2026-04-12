# Contributing

## Prerequisites

- **Node.js 20+** (see [`.node-version`](.node-version); use nvm/fnm/Volta if helpful)
- npm (lockfile: [`package-lock.json`](package-lock.json))

## Clone → green

```bash
git clone <repo-url> && cd mcp-parallel
npm ci
npm run validate   # lint + typecheck + test (pretest builds dist/)
```

## Layout

- Implementation: [`src/`](src/README.md) (each major folder has its own `README.md`)
- How to extend: [`docs/EXTENDING.md`](docs/EXTENDING.md)
- Tests: [`tests/README.md`](tests/README.md)
- **TypeScript**: `tsconfig.build.json` emits `dist/` from `src/`; root `tsconfig.json` includes `tests/` for ESLint/typecheck (no emit).

## Pull requests

- Run **`npm run validate`** before pushing.
- Prefer small commits; link issues when relevant.

## License

By contributing, you agree your contributions are licensed under the project [LICENSE](LICENSE) (MIT).
