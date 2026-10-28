import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Projects, projects } from './Projects';

describe('Projects page', () => {
  it('renders one article per project from the JSON data', () => {
    render(<Projects />);

    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(projects.length);
    expect(projects.length).toBeGreaterThan(0);
  });

  it('shows title, description and tags for each project', () => {
    render(<Projects />);

    for (const project of projects) {
      const card = screen.getByRole('article', { name: project.title });
      expect(within(card).getByText(project.description)).toBeInTheDocument();
      for (const tag of project.tags) {
        expect(within(card).getByText(tag)).toBeInTheDocument();
      }
    }
  });

  it('updates the document title and description', () => {
    document.head.innerHTML = '<meta name="description" content="" />';
    render(<Projects />);

    expect(document.title).toBe('Projects | cicd-showcase');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      expect.stringContaining('engineering practices'),
    );
  });
});
