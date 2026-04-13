# Publishing v1 (checklist)

## Before `npm publish`

1. **`package.json`**
   - Set **`version`** (e.g. `1.0.0`).
   - Set **`repository`**, **`homepage`**, and **`bugs`** to your real Git URLs (npm and users rely on these).
2. **Build artifacts**
   - Run **`npm run validate`** (lint, typecheck, tests, build).
3. **Dry run**
   - `npm pack` and inspect the tarball: should contain `dist/`, `README.md`, `LICENSE` (per `"files"`).
4. **Login**
   - `npm login` (or CI with trusted publishing / OIDC).

## Publish

```bash
npm publish --access public
```

(Use `--access public` if the scope/package name requires it.)

## After publish

- Smoke test: `npx sennit@latest doctor` (package and CLI are both **`sennit`**).
- Tag the release in git: `git tag v1.0.0 && git push origin v1.0.0` (adjust version).

## Versioning

Follow [semver](https://semver.org/): breaking config or CLI → major; new backwards-compatible features → minor; fixes → patch.
