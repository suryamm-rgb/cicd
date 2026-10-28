# cicd-showcase

A small company/portfolio website (Home, About, Projects, Contact) whose real purpose is to demonstrate
an industry-standard CI/CD pipeline: quality gates on every pull request, security scanning, an
immutable container image promoted through `test` → `stage` → `production`, and governed releases.

The app is deliberately simple. The engineering around it is the point.

## Architecture

```text
 feature/*, bugfix/*                 release managers only                release managers only
 ─────────────────────► test ─────────────────────────────► stage ───────────────────────────► main
      squash-merge PR      │        merge-commit PR            │       merge-commit PR          │
                           ▼                                   ▼                                ▼
                      CI (8 checks)                       CI (8 checks)                    CI (8 checks)
                           ▼                                   ▼                                ▼
                  cd-test: build image            cd-stage: re-tag image          cd-prod: approval gate,
                  deploy to TEST host             (same tree, no rebuild)         re-tag image, deploy,
                                                  deploy to STAGE host            tag + GitHub Release
```

| Layer     | Choice                                                                 |
| --------- | ---------------------------------------------------------------------- |
| App       | Vite, React 19, TypeScript (strict), React Router, CSS Modules         |
| Quality   | ESLint 9 (typescript-eslint, react-hooks, jsx-a11y), Prettier          |
| Tests     | Vitest + Testing Library (80% lines/branches), Playwright + axe-core   |
| Budgets   | Lighthouse CI: at least 0.9 for Performance, A11y, Best Practices, SEO |
| Hooks     | Husky, lint-staged, commitlint (Conventional Commits)                  |
| Container | Multi-stage Dockerfile, `nginx-unprivileged` (non-root, port 8080)     |
| CI/CD     | GitHub Actions (all actions pinned to full commit SHAs), GHCR          |

Key behaviours:

- **Build info** – `VITE_APP_VERSION` and `VITE_COMMIT_SHA` are injected at build time, shown in the
  footer, and written to a static `/health.json` (`{status, version, commit, buildTime}`).
- **Build once** – images are tagged `sha-<commit>` and `tree-<git tree hash>`. A commit with an
  already-built tree is re-tagged instead of rebuilt, so what was tested is what ships.
- **Accessibility** – WCAG 2.2 AA, enforced by axe on every page in light and dark mode.

## Project layout

See [the folder tree in docs/cicd.md](docs/cicd.md#folder-tree). Source lives in `src/`, end-to-end
tests in `e2e/`, workflows in `.github/workflows/`, and repository governance in
`scripts/setup-github.sh`.

## Run locally

Requires Node 22 (`nvm use` reads `.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:5173
```

Build info defaults to the `package.json` version and `git rev-parse HEAD`. Override with
`VITE_APP_VERSION` / `VITE_COMMIT_SHA` (see `.env.example`).

### npm scripts

| Script                  | What it does                                                        |
| ----------------------- | ------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server                                                     |
| `npm run build`         | Production build to `dist/` (also emits `health.json`)              |
| `npm run preview`       | Serve `dist/` locally on port 4173                                  |
| `npm run lint`          | ESLint                                                              |
| `npm run lint:fix`      | ESLint with autofix                                                 |
| `npm run format`        | Prettier write                                                      |
| `npm run format:check`  | Prettier check (used by CI)                                         |
| `npm run typecheck`     | `tsc --noEmit` (strict)                                             |
| `npm test`              | Vitest, single run                                                  |
| `npm run test:watch`    | Vitest watch mode                                                   |
| `npm run test:coverage` | Vitest with coverage thresholds (80% lines and branches)            |
| `npm run e2e:install`   | Install Playwright Chromium                                         |
| `npm run e2e`           | Playwright + axe against `vite preview` (run `npm run build` first) |
| `npm run lighthouse`    | Lighthouse CI against `vite preview` (needs a build and Chrome)     |

Run everything the CI runs:

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test:coverage \
  && npm run build && npm run e2e && npm run lighthouse
```

## Run in Docker

```bash
docker build \
  --build-arg VITE_APP_VERSION="$(node -p "require('./package.json').version")" \
  --build-arg VITE_COMMIT_SHA="$(git rev-parse HEAD)" \
  -t cicd-showcase .
docker run --rm -p 8080:8080 cicd-showcase
curl http://localhost:8080/health.json
```

The container runs as a non-root user, serves on 8080, falls back to `index.html` for client-side
routes, and sets a strict Content-Security-Policy plus the other security headers (see `nginx.conf`).
It has a `HEALTHCHECK` on `/health.json`.

## How CI/CD works

1. **Pull request** → `ci.yml` runs eight jobs. Their names are the required status checks:
   `commit-lint`, `lint`, `unit-test`, `build`, `e2e`, `lighthouse`, `security`, `docker`.
   `codeql.yml` adds static analysis (PRs, pushes to `main`, weekly).
2. **Merge to `test`** → `cd-test.yml` waits for CI on that commit, builds and pushes the image to
   `ghcr.io`, deploys over SSH, and smoke-tests `/health.json`.
3. **Release managers merge `test` → `stage`** → `cd-stage.yml` re-tags the existing image (same
   source tree) and deploys.
4. **Release managers merge `stage` → `main`** → `cd-prod.yml` pauses for approval on the
   `production` environment, deploys the same image, then creates a tag and GitHub Release.
5. **Rollback** → run `rollback.yml` with an environment and a commit SHA; it redeploys that
   commit's existing image. Nothing is built.

Everything is wired by `deploy.yml` (reusable). Setup, secrets, the run order and a verification
checklist are in [docs/cicd.md](docs/cicd.md). Branching and commit rules are in
[CONTRIBUTING.md](CONTRIBUTING.md). Vulnerability reporting: [SECURITY.md](SECURITY.md).
