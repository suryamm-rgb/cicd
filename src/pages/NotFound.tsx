import { Link } from 'react-router';
import { usePageMeta } from '../lib/usePageMeta';
import styles from './Page.module.css';

export function NotFound() {
  usePageMeta('Page not found', 'The page you were looking for does not exist.');

  return (
    <section aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">404 &ndash; Page not found</h1>
      <p className={styles.lead}>Sorry, we could not find the page you were looking for.</p>
      <Link className={styles.button} to="/">
        Back to the home page
      </Link>
    </section>
  );
}
