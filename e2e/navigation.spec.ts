import { expect, test } from '@playwright/test';

test.describe('navigation', () => {
  test('visits every page from the primary navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/cicd-showcase/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ship small sites');

    const nav = page.getByRole('navigation', { name: 'Primary' });

    await nav.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page).toHaveTitle('About | cicd-showcase');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('About us');

    await nav.getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page).toHaveTitle('Projects | cicd-showcase');
    await expect(page.getByRole('article')).toHaveCount(6);

    await nav.getByRole('link', { name: 'Contact' }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page).toHaveTitle('Contact | cicd-showcase');

    await nav.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('supports deep links and shows build info in the footer', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projects');
    await expect(page.getByTestId('build-info')).toContainText(/Version \S+ · commit \S+/);
  });

  test('skip link is the first focusable element and moves focus to main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('shows the 404 page for unknown routes', async ({ page }) => {
    await page.goto('/definitely/not/here');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('404');
    await page.getByRole('link', { name: 'Back to the home page' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('serves static health, robots and sitemap files', async ({ request }) => {
    const health = await request.get('/health.json');
    expect(health.ok()).toBe(true);
    const body = (await health.json()) as Record<string, string>;
    expect(body).toMatchObject({ status: 'ok' });
    expect(body.version).toBeTruthy();
    expect(body.commit).toBeTruthy();
    expect(Date.parse(body.buildTime ?? '')).not.toBeNaN();

    expect((await request.get('/robots.txt')).ok()).toBe(true);
    expect(await (await request.get('/sitemap.xml')).text()).toContain('<urlset');
  });
});
