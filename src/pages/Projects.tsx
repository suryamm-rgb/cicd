import projectsData from '../data/projects.json';
import { usePageMeta } from '../lib/usePageMeta';
import styles from './Page.module.css';

export interface Project {
  id: string;
  title: string;
  description: string;
  tags: string[];
  year: number;
  status: string;
}

export const projects: Project[] = projectsData;

export function Projects() {
  usePageMeta(
    'Projects',
    'Explore the engineering practices behind cicd-showcase, from quality gates to immutable images and fast rollbacks.',
  );

  return (
    <>
      <h1>Projects</h1>
      <p className={styles.lead}>
        The practices and building blocks that make up our delivery pipeline.
      </p>

      {projects.length === 0 ? (
        <p>No projects to show yet.</p>
      ) : (
        <ul className={`${styles.grid} ${styles.section}`} aria-label="Project list">
          {projects.map((project) => (
            <li key={project.id}>
              <article className={styles.card} aria-labelledby={`project-${project.id}`}>
                <h2 id={`project-${project.id}`}>{project.title}</h2>
                <p>{project.description}</p>
                <ul className={styles.meta} aria-label="Technologies">
                  {project.tags.map((tag) => (
                    <li key={tag} className={styles.tag}>
                      {tag}
                    </li>
                  ))}
                </ul>
                <p className={styles.status}>
                  {project.status} &middot; {project.year}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
