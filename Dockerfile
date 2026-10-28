# syntax=docker/dockerfile:1

# ---- build stage -------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
# --ignore-scripts skips the husky "prepare" hook (there is no git repo in the image).
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

COPY . .

ARG VITE_APP_VERSION=0.0.0
ARG VITE_COMMIT_SHA=unknown
ENV VITE_APP_VERSION=$VITE_APP_VERSION \
    VITE_COMMIT_SHA=$VITE_COMMIT_SHA
RUN npm run build

# ---- runtime stage -----------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime

ARG VITE_APP_VERSION=0.0.0
ARG VITE_COMMIT_SHA=unknown
ARG VCS_TREE=unknown
LABEL org.opencontainers.image.title="cicd-showcase" \
      org.opencontainers.image.version="$VITE_APP_VERSION" \
      org.opencontainers.image.revision="$VITE_COMMIT_SHA" \
      io.cicd-showcase.source-tree="$VCS_TREE"

COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Runs as the non-root "nginx" user (uid 101) inherited from the base image.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health.json || exit 1

CMD ["nginx", "-g", "daemon off;"]
