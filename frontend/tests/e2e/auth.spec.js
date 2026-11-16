const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');

test('donor can sign up, log in, and log out', async ({ page }) => {
  const email = `e2e-donor-${randomUUID()}@example.com`;
  const password = 'E2e-Test-Password-123!';
  const name = 'Playwright Donor';

  await page.goto('/signup.html');
  await page.locator('#name').fill(name);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#role').selectOption('donor');

  await expect(page.locator('#donorTypeWrapper')).toBeVisible();
  await page.locator('#donorType').selectOption('instant');
  await page.locator('#signupBtn').click();

  await expect(page.locator('#notification')).toContainText(/registered successfully/i);
  await expect(page).toHaveURL(/login\.html$/);

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#userType').selectOption('donor');
  await page.locator('#loginBtn').click();

  await expect(page).toHaveURL(/donorDashboard\.html$/);
  const storedAuth = await page.evaluate(() => ({
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user')),
  }));

  expect(storedAuth.token).toBeTruthy();
  expect(storedAuth.user).toMatchObject({ name, email, role: 'donor' });

  const welcomeModal = page.locator('.welcome-modal');
  if (await welcomeModal.isVisible()) {
    await page.locator('.welcome-modal .close-btn').click();
    await expect(welcomeModal).toBeHidden();
  }

  await page.locator('#logoutBtn').click();
  await expect(page).toHaveURL(/login\.html$/);

  const clearedAuth = await page.evaluate(() => ({
    token: localStorage.getItem('token'),
    user: localStorage.getItem('user'),
  }));
  expect(clearedAuth).toEqual({ token: null, user: null });

  await page.goto('/donorDashboard.html');
  await expect(page).toHaveURL(/login\.html$/);
});
