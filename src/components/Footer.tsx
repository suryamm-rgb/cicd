import { buildInfo, shortSha } from '../lib/buildInfo';
import { SITE_NAME } from '../lib/usePageMeta';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p>
          &copy; {new Date().getFullYear()} {SITE_NAME}
        </p>
        <p data-testid="build-info">
          Version {buildInfo.version} &middot; commit <code>{shortSha(buildInfo.commit)}</code>
        </p>
      </div>
    </footer>
  );
}
