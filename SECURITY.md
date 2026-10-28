# Security Policy

## Supported versions

Only the version currently deployed from `main` receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue.** Report vulnerabilities privately using GitHub's
[private vulnerability reporting](../../security/advisories/new) (Security tab → "Report a
vulnerability"). If that is unavailable, contact the DevOps team through your usual internal channel.

Please include a description, reproduction steps, the affected version (shown in the site footer and
at `/health.json`) and the potential impact.

You can expect an acknowledgement within 3 business days and a status update at least every 7 days
until the issue is resolved. Fixes ship through the normal hotfix flow described in
[CONTRIBUTING.md](CONTRIBUTING.md).

## What we do to stay secure

- Secret scanning with push protection, and gitleaks on every pull request.
- Dependency review, `npm audit`, and Dependabot (npm, GitHub Actions and Docker).
- CodeQL analysis on pull requests, on `main`, and weekly.
- Container images scanned with Trivy; the runtime image is non-root with a strict CSP.
- All third-party GitHub Actions are pinned to full commit SHAs.
- Workflows use least-privilege `GITHUB_TOKEN` permissions; production needs reviewer approval.
