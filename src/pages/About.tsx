import { usePageMeta } from '../lib/usePageMeta';
import styles from './Page.module.css';

const principles = [
  [
    'Small batches',
    'Short-lived branches and squash merges keep changes easy to review and revert.',
  ],
  [
    'Shift left',
    'Linting, typing, testing and security scanning happen before code reaches a shared branch.',
  ],
  ['Build once', 'The artifact that was tested is the artifact that ships.'],
  ['Observable', 'Every deployment exposes its version and commit at /health.json.'],
] as const;

export function About() {
  usePageMeta(
    'About',
    'Learn about the principles behind cicd-showcase: small batches, shift-left quality, build once and observable deployments.',
  );

  return (
    <>
      <h1>About us</h1>
      <p className={styles.lead}>
        We are a small engineering team that cares about the path from a commit to production. This
        site is intentionally simple so the delivery pipeline around it can be the star.
      </p>

      <section className={styles.section} aria-labelledby="principles-heading">
        <h2 id="principles-heading">How we work</h2>
        <ul className={styles.grid}>
          {principles.map(([title, text]) => (
            <li key={title}>
              <article className={styles.card}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
