import { expect, test } from '@playwright/test';

test.describe('contact form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact');
  });

  test('shows validation errors when submitted empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByRole('alert')).toContainText('Please fix 3 errors');
    await expect(page.getByLabel('Name')).toBeFocused();
    await expect(page.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Enter your email address.')).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('rejects an invalid email address', async ({ page }) => {
    await page.getByLabel('Name').fill('Ada Lovelace');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Message').fill('This message is long enough.');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByText(/valid email address/)).toBeVisible();
    await expect(page.getByLabel('Email')).toBeFocused();
  });

  test('shows a success message for a valid submission', async ({ page }) => {
    await page.getByLabel('Name').fill('Ada Lovelace');
    await page.getByLabel('Email').fill('ada@example.com');
    await page.getByLabel('Message').fill('Hello, I would like to learn more about your pipeline.');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByRole('status')).toContainText('Thank you');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByLabel('Name')).toHaveValue('');
  });

  test('can be completed using only the keyboard', async ({ page }) => {
    await page.getByLabel('Name').focus();
    await page.keyboard.type('Grace Hopper');
    await page.keyboard.press('Tab');
    await page.keyboard.type('grace@example.com');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Testing keyboard-only form completion.');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('status')).toBeVisible();
  });
});
