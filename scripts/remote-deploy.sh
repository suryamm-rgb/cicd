#!/usr/bin/env bash
# Runs ON the deploy host. deploy.yml streams this file over SSH:
#   { printf 'GHCR_TOKEN=%q\n' "$TOKEN"; cat scripts/remote-deploy.sh; } | ssh host 'bash -s -- <args>'
# Args: <image-ref> <container-name> <host-port> <registry-user>
set -euo pipefail

IMAGE="${1:?image ref required}"
NAME="${2:?container name required}"
PORT="${3:?host port required}"
REG_USER="${4:?registry user required}"
: "${GHCR_TOKEN:?GHCR_TOKEN must be provided on stdin}"

trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$REG_USER" --password-stdin
docker pull "$IMAGE"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  --publish "${PORT}:8080" \
  --read-only \
  --tmpfs /tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  "$IMAGE"

# Keep the host tidy but retain recent images so a rollback can start without a pull.
docker image prune -af --filter "until=720h" >/dev/null || true
echo "Deployed $IMAGE as $NAME on port $PORT"
