# CI/CD, governance and secrets

## Assumptions

- Repository: `<org>/<repo>`, organisation-owned, with teams `developers` (write), `release-managers`
  (maintain) and `devops` (admin, needed to manage rulesets and environments).
- Default branch is `test`; `main` is production. `stage` and `test` are created from `main` if missing.
- One Docker host per environment, reached over SSH with a key-based deploy user that can run `docker`.
- Hosts expose the app on `HOST_PORT` (default 8080), and `APP_URL` is where `/health.json` is reachable
  from GitHub-hosted runners (typically a reverse proxy with TLS in front of the container).
- Images are published to `ghcr.io/<owner>/<repo>`, and the hosts pull with the workflow's short-lived
  `GITHUB_TOKEN` (no long-lived registry credentials are stored).
- A promotion (merge commit) of an already-built commit has the same git tree, so its image is
  re-tagged. The smoke test therefore accepts a `/health.json` commit that equals the deployed commit
  **or** has an identical tree.
- Pushes to long-lived branches queue their CI runs (they are not cancelled) so each commit has CI
  evidence for the CD gate. Pull request runs are cancelled when superseded.
- The ruleset API cannot vary approvals per branch inside one ruleset, so governance uses layered
  rulesets (below). GitHub applies the most restrictive combination.

## Folder tree

```text
.
├── .editorconfig  .env.example  .gitignore  .npmrc  .nvmrc  .prettierrc.json  .prettierignore
├── .dockerignore  Dockerfile  nginx.conf  nginx-security-headers.conf
├── commitlint.config.js  .lintstagedrc.json  eslint.config.js  lighthouserc.json
├── playwright.config.ts  vite.config.ts  tsconfig.json  package.json  index.html
├── README.md  CONTRIBUTING.md  SECURITY.md
├── .husky/            pre-commit, commit-msg
├── .github/
│   ├── CODEOWNERS  PULL_REQUEST_TEMPLATE.md  dependabot.yml
│   ├── ISSUE_TEMPLATE/  bug_report.yml  feature_request.yml  config.yml
│   └── workflows/     ci.yml  codeql.yml  deploy.yml  cd-test.yml  cd-stage.yml  cd-prod.yml  rollback.yml
├── docs/cicd.md
├── e2e/               navigation.spec.ts  contact.spec.ts  a11y.spec.ts
├── public/            favicon.svg  hero.svg  robots.txt  sitemap.xml
├── scripts/           setup-github.sh  remote-deploy.sh
└── src/
    ├── main.tsx  App.tsx  vite-env.d.ts  App.test.tsx
    ├── components/    Layout  Header  Footer (+ CSS Modules)
    ├── pages/         Home  About  Projects  Contact  NotFound (+ CSS Modules, tests)
    ├── data/          projects.json
    ├── lib/           validation  buildInfo  usePageMeta
    ├── styles/        global.css
    └── test/          setup.ts
```

## Order to run things

1. Push `main`, then run `DRY_RUN=1 OWNER=<org> REPO=<repo> ./scripts/setup-github.sh` and read the output.
2. Run it for real (`gh auth login` as a repository admin first):
   `OWNER=<org> REPO=<repo> ./scripts/setup-github.sh`. It is safe to re-run at any time.
3. In **CODEOWNERS** replace `<org>`; in `ISSUE_TEMPLATE/config.yml` replace `<org>/<repo>`;
   in `public/robots.txt` and `public/sitemap.xml` replace `https://example.com`.
4. Create the secrets and variables below on each environment (`test`, `stage`, `production`).
5. Push `test`, `stage` and `main` through pull requests. The first CI run on each long-lived branch
   shows the job names GitHub will accept as required checks.
6. Run through the verification checklist.

## Secrets and variables per environment

Set these under **Settings → Environments → _name_**. All examples are placeholders, never real values.

### Secrets (encrypted)

| Name                 | Example format                                                              | Used by                              |
| -------------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| `DEPLOY_SSH_KEY`     | `-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END OPENSSH PRIVATE KEY-----` | `deploy.yml` → "Configure SSH"       |
| `DEPLOY_KNOWN_HOSTS` | `deploy.test.example.com ssh-ed25519 AAAA…` (output of `ssh-keyscan`)       | `deploy.yml` → host key verification |

Use a separate key pair per environment, restricted to a dedicated deploy user. No other secrets are
needed: GHCR access uses the automatic `GITHUB_TOKEN`.

### Variables (plain text)

| Name             | Example                    | Default         | Used by                                  |
| ---------------- | -------------------------- | --------------- | ---------------------------------------- |
| `DEPLOY_HOST`    | `deploy.test.example.com`  | — (required)    | SSH target                               |
| `DEPLOY_USER`    | `deploy`                   | — (required)    | SSH user                                 |
| `DEPLOY_PORT`    | `22`                       | `22`            | SSH port                                 |
| `APP_URL`        | `https://test.example.com` | — (required)    | Smoke test and environment URL           |
| `CONTAINER_NAME` | `cicd-showcase`            | `cicd-showcase` | Container name on the host               |
| `HOST_PORT`      | `8080`                     | `8080`          | Host port mapped to the container's 8080 |

Repository-level secrets are not required. Never put secrets in `VITE_*` variables: they are public.

## Required status checks

`commit-lint`, `lint`, `unit-test`, `build`, `e2e`, `lighthouse`, `security`, `docker` (job names in
`ci.yml`). `codeql.yml` is reported separately and is not required by default.

## Rulesets created by `scripts/setup-github.sh`

| Ruleset                 | Branches        | Effect                                                                                                                                                                                          |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protect-long-lived`    | test/stage/main | PR required, 1 approval, stale approvals dismissed, last push approved by someone else, conversations resolved, all 8 checks required and up to date, no force push, no deletion, **no bypass** |
| `protect-main-extra`    | main            | 2 approvals, code owner review, merge commits only                                                                                                                                              |
| `protect-stage-extra`   | stage           | merge commits only                                                                                                                                                                              |
| `release-managers-only` | stage, main     | `update` restricted; only `release-managers` may bypass, **pull-request mode only**                                                                                                             |

Environments: `test` ← branch `test`, `stage` ← `stage`, `production` ← `main`; production requires
`release-managers` as reviewers and prevents self-review.

## Verification checklist

Run these after setup, with a normal developer account (member of `developers` only).

1. **A developer cannot push to test, stage or main**
   ```bash
   git switch test && git commit --allow-empty -m "chore: direct push probe" && git push origin test
   ```
   Expect `GH013: Repository rule violations found` (same for `stage` and `main`).
2. **A bad commit message fails**
   Open a PR from `feature/probe` with the title `updated stuff`, or push a commit like
   `git commit --no-verify -m "Fixed things"`. Expect the `commit-lint` check to fail.
3. **A lint, test or security failure blocks the merge**
   - Lint: commit an unused variable → `lint` fails.
   - Test: change an assertion in `src/lib/validation.test.ts` → `unit-test` fails.
   - Security: add a fake secret such as `AKIAIOSFODNN7EXAMPLE` in a file → `security` fails (and push
     protection may stop the push first).
     In each case the merge button is disabled with "Required statuses must pass".
4. **Only release managers can merge into stage or main**
   As a developer, open a `test` → `stage` PR with all checks green and approvals: the merge button
   is unavailable ("Merging is blocked", bypass not available). As a `release-managers` member, the same
   PR can be merged (bypass in pull-request mode). Direct pushes remain blocked for everyone.
5. **Production waits for approval**
   Merge `stage` → `main`. The "CD (production)" run shows `deploy (production)` as
   "Waiting for review". Only a `release-managers` member other than the person who triggered it can
   approve. Nothing is deployed before then; the image is only re-tagged.
6. **Image reuse**
   In the stage and production run summaries, "Image reused (no rebuild)" is `true`.
7. **Rollback works**
   Actions → Rollback → _Run workflow_ on branch `test` with `environment=test` and the SHA of an
   earlier deployed commit. The deploy summary shows "Rollback: true", `/health.json` reports that
   commit, and no build step ran. For production run it on `main`; it asks for approval again.

## Rollback and recovery notes

- Rollback only redeploys an image tagged `sha-<commit>` that already exists in GHCR. If it was
  never built, the workflow fails instead of building.
- A failed smoke test automatically restores the previous container image and fails the run.
- To undo a bad merge in source control, revert it with a PR (`revert:` type), then promote normally.
