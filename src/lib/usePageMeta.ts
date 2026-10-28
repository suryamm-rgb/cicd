import { useEffect } from 'react';

export const SITE_NAME = 'cicd-showcase';

/** Sets the document title and meta description for the current page. */
export function usePageMeta(title: string, description: string): void {
  useEffect(() => {
    document.title =
      title === SITE_NAME ? `${SITE_NAME} | A CI/CD demonstration site` : `${title} | ${SITE_NAME}`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}
