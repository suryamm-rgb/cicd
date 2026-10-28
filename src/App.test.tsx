import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('routing', () => {
  it('renders the 404 page for unknown routes', () => {
    renderAt('/this-page-does-not-exist');

    expect(screen.getByRole('heading', { level: 1, name: /404/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to the home page/i })).toHaveAttribute(
      'href',
      '/',
    );
    expect(document.title).toBe('Page not found | cicd-showcase');
  });

  it.each([
    ['/', /ship small sites/i],
    ['/about', /about us/i],
    ['/projects', /^projects$/i],
    ['/contact', /^contact$/i],
  ])('renders %s', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('provides a skip link and build info in the footer', () => {
    renderAt('/');

    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByTestId('build-info')).toHaveTextContent(/version/i);
  });

  it('navigates between pages and moves focus to the content', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('link', { name: 'About' }));

    expect(screen.getByRole('heading', { level: 1, name: /about us/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
  });
});
