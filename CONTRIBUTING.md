# Contributing

## Branch strategy

Long-lived branches: **`test` → `stage` → `main`**.

| Branch  | Purpose          | Who merges                 | Merge method                 |
| ------- | ---------------- | -------------------------- | ---------------------------- |
| `test`  | Integration / QA | Anyone with an approved PR | Squash (feature, bugfix PRs) |
| `stage` | Pre-production   | Release managers only      | Merge commit                 |
| `main`  | Production       | Release managers only      | Merge commit                 |

Rules:

- **Developers never push to `test`, `stage` or `main`.** They only open pull requests.
- Branch from `test` as `feature/<short-name>` or `bugfix/<short-name>` and open a PR into `test`.
  Use a squash merge.
- Promotion is `test` → `stage` → `main` by pull request with a **merge commit**, done only by
  release managers. Do not squash or rebase promotions; the history must stay linear in meaning.
- **Hotfixes:** branch `hotfix/<short-name>` from `main`, open a PR into `main`, then
  **back-merge `main` into `stage` and `test`** (merge commits, via PRs) so the fix is not lost.
- Delete your branch after merge (GitHub does this automatically).

```text
feature/x ──squash──► test ──merge──► stage ──merge──► main
                       ▲                │                 ▲
                       └── back-merge ──┴── back-merge ───┴── hotfix/y (from main)
```

## Commit rules

Commits and **pull request titles** follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(optional scope): <description>
```

- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
  `chore`, `revert`.
- The header is at most 100 characters.
- A squash merge uses the PR title as the commit message, so the PR title is checked in CI.
- Promotion PRs also need a conventional title, for example `chore: promote test to stage`.

Locally, Husky enforces this:

- `pre-commit` runs lint-staged (ESLint `--fix` and Prettier on staged files).
- `commit-msg` runs commitlint.

Run `npm install` once to activate the hooks. Never bypass them with `--no-verify`; CI runs the same
checks and will fail the PR anyway.

## Before opening a PR

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test:coverage
npm run build && npm run e2e
```

Keep PRs small and focused, and fill in the PR template. New behaviour needs tests; coverage must stay
at or above 80% for lines and branches. New UI must pass the axe checks and keep Lighthouse scores
at 0.9 or higher.

## Reviews

- `test` and `stage` need 1 approval; `main` needs 2 including a code owner.
- Approvals are dismissed when new commits are pushed, and the latest push needs a fresh approval
  from someone other than its author.
- All conversations must be resolved and all required checks green and up to date before merging.
