import { Link } from 'react-router';
import { SITE_NAME, usePageMeta } from '../lib/usePageMeta';
import styles from './Page.module.css';

const highlights = [
  {
    title: 'Automated quality gates',
    text: 'Lint, type check, unit tests, end-to-end tests, accessibility and Lighthouse budgets run on every pull request.',
  },
  {
    title: 'One image, many environments',
    text: 'A container image is built once per source tree and promoted unchanged from test to stage to production.',
  },
  {
    title: 'Governed releases',
    text: 'Protected branches, required reviews and approval gates keep every release deliberate and auditable.',
  },
] as const;

export function Home() {
  usePageMeta(
    SITE_NAME,
    'cicd-showcase is a small, production-grade website that demonstrates an industry-standard CI/CD pipeline.',
  );

  return (
    <>
      <section className={styles.hero} aria-labelledby="home-heading">
        <div>
          <h1 id="home-heading">Ship small sites with big-pipeline confidence</h1>
          <p className={styles.lead}>
            {SITE_NAME} is a deliberately simple website built to showcase an industry-standard
            CI/CD pipeline: fast feedback, strong security checks and repeatable releases.
          </p>
          <div className={styles.actions}>
            <Link className={styles.button} to="/projects">
              View projects
            </Link>
            <Link className={styles.buttonSecondary} to="/contact">
              Get in touch
            </Link>
          </div>
        </div>
        <img
          className={styles.heroImage}
          src="/hero.svg"
          width="640"
          height="320"
          alt="Four connected circles with check marks, representing the stages of a passing pipeline"
        />
      </section>

      <section aria-labelledby="highlights-heading">
        <h2 id="highlights-heading">What this project demonstrates</h2>
        <ul className={`${styles.grid} ${styles.grid3}`}>
          {highlights.map((item) => (
            <li key={item.title}>
              <article className={styles.card}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
