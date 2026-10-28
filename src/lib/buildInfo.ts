export const buildInfo = {
  version: import.meta.env.VITE_APP_VERSION ?? 'dev',
  commit: import.meta.env.VITE_COMMIT_SHA ?? 'unknown',
} as const;

export function shortSha(commit: string): string {
  return commit.slice(0, 7);
}
