#!/usr/bin/env bash
# Configures branch governance, environments and repository security with the GitHub API.
#
# - Idempotent: every step reads the current state first and only changes what differs.
# - Prints every change it makes ("CHANGE") and everything it leaves alone ("ok").
# - Never deletes anything. Things that look wrong but would need a delete are reported as "WARN".
#
# Requirements: gh (authenticated as a repository admin), jq, bash 4+.
#
# Usage:
#   OWNER=my-org REPO=my-repo ./scripts/setup-github.sh            # apply
#   DRY_RUN=1 OWNER=my-org REPO=my-repo ./scripts/setup-github.sh  # show what would change
#
# Optional environment variables:
#   TEAM_DEVELOPERS=developers  TEAM_RELEASE_MANAGERS=release-managers  TEAM_DEVOPS=devops
#   REVIEWER_USERS=alice,bob    Production reviewers when the repo is NOT organisation-owned
#   DEFAULT_BRANCH_FROM=main    Branch used to create `stage` and `test` when they do not exist
set -euo pipefail

OWNER="${OWNER:-}"
REPO="${REPO:-}"
DRY_RUN="${DRY_RUN:-0}"
TEAM_DEVELOPERS="${TEAM_DEVELOPERS:-developers}"
TEAM_RELEASE_MANAGERS="${TEAM_RELEASE_MANAGERS:-release-managers}"
TEAM_DEVOPS="${TEAM_DEVOPS:-devops}"
REVIEWER_USERS="${REVIEWER_USERS:-}"
BASE_BRANCH="${DEFAULT_BRANCH_FROM:-main}"

# Job names from .github/workflows/ci.yml. They are the required status checks.
REQUIRED_CHECKS=(commit-lint lint unit-test build e2e lighthouse security docker)
LONG_LIVED=(test stage main)

WARNINGS=()

log() { printf '%s\n' "$*"; }
ok() { log "  ok      $*"; }
change() { log "  CHANGE  $*"; }
warn() { log "  WARN    $*"; WARNINGS+=("$*"); }
section() { log ""; log "== $* =="; }

need() { command -v "$1" >/dev/null 2>&1 || { log "error: '$1' is required"; exit 1; }; }
need gh
need jq

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
  if slug="$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)"; then
    OWNER="${slug%%/*}"
    REPO="${slug##*/}"
  else
    log "error: set OWNER and REPO (or run inside a clone of the repository)"
    exit 1
  fi
fi
R="repos/${OWNER}/${REPO}"

# Run a mutating API call unless DRY_RUN=1. Body (if any) is read from stdin as JSON.
mutate() {
  local method="$1" path="$2"
  if [ "$DRY_RUN" = "1" ]; then
    log "          (dry-run) ${method} ${path}"
    [ -t 0 ] || cat >/dev/null
    return 0
  fi
  if [ -t 0 ]; then
    gh api -X "$method" "$path" >/dev/null
  else
    gh api -X "$method" "$path" --input - >/dev/null
  fi
}

# Like mutate, but a failure is reported as a warning instead of stopping the script.
mutate_soft() {
  local description="$1"
  shift
  if ! mutate "$@"; then
    warn "${description} could not be applied (plan or permission limitation?)"
    return 1
  fi
}

get() { gh api "$@" 2>/dev/null; }

# ------------------------------------------------------------------------------------------------
section "Preflight (${OWNER}/${REPO}$([ "$DRY_RUN" = "1" ] && echo ', DRY RUN'))"

repo_json="$(gh api "$R")"
if [ "$(jq -r '.permissions.admin' <<<"$repo_json")" != "true" ]; then
  log "error: your gh token needs admin permission on ${OWNER}/${REPO}"
  exit 1
fi
owner_type="$(gh api "users/${OWNER}" --jq .type)"
IS_ORG=false
[ "$owner_type" = "Organization" ] && IS_ORG=true
ok "admin access confirmed; owner type: ${owner_type}"
if [ "$IS_ORG" != "true" ]; then
  warn "${OWNER} is a personal account: team permissions, team reviewers and team-only bypass cannot be configured. See the manual steps at the end."
fi

team_id() {
  # Prints the team id, or nothing when the team does not exist (or the owner is not an org).
  [ "$IS_ORG" = "true" ] || return 0
  get "orgs/${OWNER}/teams/$1" --jq .id || true
}

# ------------------------------------------------------------------------------------------------
section "Long-lived branches"

base_sha="$(gh api "${R}/git/ref/heads/${BASE_BRANCH}" --jq .object.sha 2>/dev/null || true)"
if [ -z "$base_sha" ]; then
  log "error: base branch '${BASE_BRANCH}' does not exist yet; push it first."
  exit 1
fi
for branch in stage test; do
  if get "${R}/branches/${branch}" >/dev/null; then
    ok "branch ${branch} exists"
  else
    change "create branch ${branch} from ${BASE_BRANCH} (${base_sha:0:7})"
    jq -n --arg ref "refs/heads/${branch}" --arg sha "$base_sha" '{ref: $ref, sha: $sha}' \
      | mutate POST "${R}/git/refs"
  fi
done

# ------------------------------------------------------------------------------------------------
section "Repository settings"

desired_settings="$(jq -n '{
  default_branch: "test",
  allow_squash_merge: true,
  allow_merge_commit: true,
  allow_rebase_merge: false,
  delete_branch_on_merge: true,
  squash_merge_commit_title: "PR_TITLE",
  squash_merge_commit_message: "BLANK"
}')"
diff_keys="$(jq -rn --argjson want "$desired_settings" --argjson have "$repo_json" \
  '$want | to_entries | map(select($have[.key] != .value) | "\(.key): \($have[.key]) -> \(.value)") | .[]')"
if [ -z "$diff_keys" ]; then
  ok "default branch, merge methods and branch cleanup already as desired"
else
  while IFS= read -r line; do change "repository setting ${line}"; done <<<"$diff_keys"
  # default_branch can only be switched once the branch exists (created above).
  mutate PATCH "$R" <<<"$desired_settings"
fi

workflow_perms="$(get "${R}/actions/permissions/workflow" || echo '{}')"
if [ "$(jq -r '.default_workflow_permissions // "unknown"' <<<"$workflow_perms")" = "read" ] \
  && [ "$(jq -r '.can_approve_pull_request_reviews // "unknown"' <<<"$workflow_perms")" = "false" ]; then
  ok "default GITHUB_TOKEN permission is read-only; Actions cannot approve PRs"
else
  change "set default GITHUB_TOKEN permission to read and disallow Actions approving PRs"
  mutate_soft "workflow token permissions" PUT "${R}/actions/permissions/workflow" \
    <<<'{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}' || true
fi

# ------------------------------------------------------------------------------------------------
section "Team access"

if [ "$IS_ORG" = "true" ]; then
  # Assumption: devops administers the repo (needed to manage rulesets and environments).
  for pair in "${TEAM_DEVELOPERS}:push" "${TEAM_RELEASE_MANAGERS}:maintain" "${TEAM_DEVOPS}:admin"; do
    team="${pair%%:*}"
    perm="${pair##*:}"
    if [ -z "$(team_id "$team")" ]; then
      warn "team '${team}' not found in ${OWNER}; create it, then re-run this script"
      continue
    fi
    current="$(get "orgs/${OWNER}/teams/${team}/repos/${OWNER}/${REPO}" --jq '.role_name // empty' || true)"
    wanted="$perm"
    [ "$perm" = "push" ] && wanted="write"
    if [ "$current" = "$wanted" ]; then
      ok "team ${team} already has ${wanted}"
    else
      change "grant team ${team} '${perm}' on ${REPO} (was: ${current:-none})"
      jq -n --arg p "$perm" '{permission: $p}' \
        | mutate_soft "team access for ${team}" PUT "orgs/${OWNER}/teams/${team}/repos/${OWNER}/${REPO}" || true
    fi
  done
else
  warn "skipping team access (personal account)"
fi

# ------------------------------------------------------------------------------------------------
# Rulesets. A normalised view of a ruleset is compared so unchanged rulesets are left alone.
NORMALIZE='{
  enforcement,
  conditions: (.conditions.ref_name | {include: (.include | sort), exclude: (.exclude | sort)}),
  bypass_actors: ((.bypass_actors // []) | map({actor_id, actor_type, bypass_mode}) | sort_by(.actor_id)),
  rules: (.rules | map(
    if .type == "required_status_checks" then
      {type, parameters: {strict: .parameters.strict_required_status_checks_policy,
                          checks: (.parameters.required_status_checks | map(.context) | sort)}}
    elif .type == "pull_request" then
      {type, parameters: (.parameters | {required_approving_review_count, dismiss_stale_reviews_on_push,
                          require_code_owner_review, require_last_push_approval,
                          required_review_thread_resolution,
                          allowed_merge_methods: (.allowed_merge_methods | sort)})}
    else {type} end) | sort_by(.type))
}'

upsert_ruleset() {
  local name="$1" desired="$2" id current
  id="$(gh api "${R}/rulesets" --jq ".[] | select(.name == \"${name}\") | .id" | head -n1 || true)"
  if [ -z "$id" ]; then
    change "create ruleset '${name}'"
    mutate_soft "ruleset ${name}" POST "${R}/rulesets" <<<"$desired" || true
    return
  fi
  current="$(gh api "${R}/rulesets/${id}" | jq -S "$NORMALIZE")"
  if [ "$current" = "$(jq -S "$NORMALIZE" <<<"$desired")" ]; then
    ok "ruleset '${name}' already up to date (id ${id})"
  else
    change "update ruleset '${name}' (id ${id})"
    mutate_soft "ruleset ${name}" PUT "${R}/rulesets/${id}" <<<"$desired" || true
  fi
}

checks_json="$(printf '%s\n' "${REQUIRED_CHECKS[@]}" | jq -R '{context: .}' | jq -s .)"

# pull_request rule builder: <approvals> <code-owner-review> <merge-methods-json>
pr_rule() {
  jq -n --argjson n "$1" --argjson owners "$2" --argjson methods "$3" '{
    type: "pull_request",
    parameters: {
      required_approving_review_count: $n,
      dismiss_stale_reviews_on_push: true,
      require_code_owner_review: $owners,
      require_last_push_approval: true,
      required_review_thread_resolution: true,
      allowed_merge_methods: $methods
    }
  }'
}

ruleset_json() { # <name> <branches-json> <rules-json> <bypass-json>
  jq -n --arg name "$1" --argjson branches "$2" --argjson rules "$3" --argjson bypass "$4" '{
    name: $name,
    target: "branch",
    enforcement: "active",
    conditions: {ref_name: {include: ($branches | map("refs/heads/" + .)), exclude: []}},
    bypass_actors: $bypass,
    rules: $rules
  }'
}

section "Rulesets"

branches_all="$(printf '%s\n' "${LONG_LIVED[@]}" | jq -R . | jq -s .)"
common_rules="$(jq -n --argjson checks "$checks_json" --argjson pr "$(pr_rule 1 false '["squash","merge"]')" '[
  {type: "deletion"},
  {type: "non_fast_forward"},
  {type: "required_status_checks",
   parameters: {strict_required_status_checks_policy: true, do_not_enforce_on_create: false,
                required_status_checks: $checks}},
  $pr
]')"
# 1) Everything long-lived: PRs only, CI required and up to date, no force push, no deletion.
#    No bypass actors. Approvals: 1 (test, stage); main is raised to 2 by ruleset 2.
upsert_ruleset "protect-long-lived" "$(ruleset_json protect-long-lived "$branches_all" "$common_rules" '[]')"

# 2) main: two approvals, code owner review, merge commits only.
upsert_ruleset "protect-main-extra" "$(ruleset_json protect-main-extra '["main"]' \
  "[$(pr_rule 2 true '["merge"]')]" '[]')"

# 3) stage: merge commits only (release managers promote test -> stage).
upsert_ruleset "protect-stage-extra" "$(ruleset_json protect-stage-extra '["stage"]' \
  "[$(pr_rule 1 false '["merge"]')]" '[]')"

# 4) stage + main: nobody may update the branch, except release managers, and only through a PR.
rm_id="$(team_id "$TEAM_RELEASE_MANAGERS")"
if [ -n "$rm_id" ]; then
  bypass="$(jq -n --argjson id "$rm_id" '[{actor_id: $id, actor_type: "Team", bypass_mode: "pull_request"}]')"
  upsert_ruleset "release-managers-only" "$(ruleset_json release-managers-only '["stage","main"]' \
    '[{"type":"update"}]' "$bypass")"
else
  warn "release-managers-only ruleset NOT created: team '${TEAM_RELEASE_MANAGERS}' not found (needs an organisation-owned repo). Without it anyone with write access and an approving review can merge into stage/main."
fi

# ------------------------------------------------------------------------------------------------
section "Environments"

reviewers_json='[]'
if [ -n "$rm_id" ]; then
  reviewers_json="$(jq -n --argjson id "$rm_id" '[{type: "Team", id: $id}]')"
elif [ -n "$REVIEWER_USERS" ]; then
  reviewers_json="$(
    for u in ${REVIEWER_USERS//,/ }; do
      gh api "users/${u}" --jq '{type: "User", id: .id}'
    done | jq -s .
  )"
fi

# True when the environment already restricts deployments to custom branches and, for production,
# requires the expected number of reviewers with self-review prevented.
environment_configured() {
  local env="$1" existing="$2"
  [ -n "$existing" ] || return 1
  [ "$(jq -r '.deployment_branch_policy.custom_branch_policies // false' <<<"$existing")" = "true" ] || return 1
  [ "$env" = "production" ] || return 0
  [ "$(jq -r '[.protection_rules[]? | select(.type == "required_reviewers") | .prevent_self_review] | first // false' <<<"$existing")" = "true" ] || return 1
  [ "$(jq -r '[.protection_rules[]? | select(.type == "required_reviewers") | .reviewers | length] | first // 0' <<<"$existing")" = "$(jq length <<<"$reviewers_json")" ]
}

ensure_environment() {
  local env="$1" branch="$2" body existing
  if [ "$env" = "production" ]; then
    if [ "$(jq length <<<"$reviewers_json")" = "0" ]; then
      warn "production environment created WITHOUT required reviewers (no release-managers team and REVIEWER_USERS unset)"
    fi
    body="$(jq -n --argjson r "$reviewers_json" '{
      wait_timer: 0, prevent_self_review: true, reviewers: $r,
      deployment_branch_policy: {protected_branches: false, custom_branch_policies: true}}')"
  else
    body='{"wait_timer":0,"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}'
  fi

  existing="$(get "${R}/environments/${env}" || true)"
  if environment_configured "$env" "$existing"; then
    ok "environment ${env} already configured"
  else
    change "create/update environment ${env} (deployments only from branch ${branch})"
    mutate_soft "environment ${env} (private repos need a paid plan for environment protection)" \
      PUT "${R}/environments/${env}" <<<"$body" || return 0
  fi

  existing="$(get "${R}/environments/${env}/deployment-branch-policies" --jq '[.branch_policies[].name] | join(" ")' || true)"
  if [[ " ${existing} " == *" ${branch} "* ]]; then
    ok "environment ${env} allows branch ${branch}"
  else
    change "allow branch ${branch} to deploy to ${env}"
    jq -n --arg n "$branch" '{name: $n, type: "branch"}' \
      | mutate_soft "deployment branch policy for ${env}" POST "${R}/environments/${env}/deployment-branch-policies" || true
  fi
  for extra in $existing; do
    [ "$extra" = "$branch" ] || warn "environment ${env} also allows branch '${extra}'; remove it in the UI if unintended (this script never deletes)"
  done
}

ensure_environment test test
ensure_environment stage stage
ensure_environment production main

# ------------------------------------------------------------------------------------------------
section "Repository security"

if get "${R}/vulnerability-alerts" >/dev/null; then
  ok "Dependabot alerts enabled"
else
  change "enable Dependabot alerts"
  mutate_soft "Dependabot alerts" PUT "${R}/vulnerability-alerts" </dev/null || true
fi

if [ "$(get "${R}/automated-security-fixes" --jq .enabled || echo false)" = "true" ]; then
  ok "Dependabot security updates enabled"
else
  change "enable Dependabot security updates"
  mutate_soft "Dependabot security updates" PUT "${R}/automated-security-fixes" </dev/null || true
fi

if [ "$(get "${R}/private-vulnerability-reporting" --jq .enabled || echo false)" = "true" ]; then
  ok "private vulnerability reporting enabled"
else
  change "enable private vulnerability reporting"
  mutate_soft "private vulnerability reporting" PUT "${R}/private-vulnerability-reporting" </dev/null || true
fi

scanning="$(jq -r '.security_and_analysis.secret_scanning.status // "unavailable"' <<<"$repo_json")"
push_protection="$(jq -r '.security_and_analysis.secret_scanning_push_protection.status // "unavailable"' <<<"$repo_json")"
if [ "$scanning" = "enabled" ] && [ "$push_protection" = "enabled" ]; then
  ok "secret scanning and push protection enabled"
else
  change "enable secret scanning and push protection (currently: ${scanning} / ${push_protection})"
  mutate_soft "secret scanning" PATCH "$R" \
    <<<'{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}' || true
fi

# ------------------------------------------------------------------------------------------------
section "Done"
if [ "$DRY_RUN" = "1" ]; then log "Dry run: nothing was changed."; fi

cat <<'EOF'

Settings the API cannot (or should not) set. Do these in the GitHub UI:
  1. Secrets and variables per environment (Settings > Environments). See docs/cicd.md for the list.
  2. Settings > Actions > General: "Require approval for all outside collaborators", and keep
     "Allow GitHub Actions to create and approve pull requests" OFF (the script sets the token default).
  3. Settings > Code security: leave "CodeQL default setup" OFF (codeql.yml is the source of truth)
     and enable the Dependency graph if it is off (required by dependency-review-action).
  4. Organisation owners: create the teams (developers, release-managers, devops), add members, and
     make sure CODEOWNERS teams have write access (they do after this script runs).
  5. Packages: after the first deploy, open ghcr.io package settings, link the package to this
     repository and set its visibility; grant the repo access (Manage Actions access).
  6. Private repositories need GitHub Team/Enterprise for environment reviewers and rulesets, and
     GitHub Advanced Security for secret scanning and code scanning.
  7. Optional hardening: enable "Require signed commits" and a merge queue if your plan offers them.
EOF

if [ "${#WARNINGS[@]}" -gt 0 ]; then
  log ""
  log "Warnings (${#WARNINGS[@]}):"
  for w in "${WARNINGS[@]}"; do log "  - ${w}"; done
fi
