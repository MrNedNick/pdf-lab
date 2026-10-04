import { expect, test } from './clean-console'

test('the home page lists every tool and opens one without a reload', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1, name: 'PDF Lab' })).toBeVisible()
  await page.getByRole('link', { name: /Merge PDFs/ }).click()
  await expect(page).toHaveURL(/\/pdf-lab\/merge\/$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Merge PDFs' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'PDF Lab' })).toBeVisible()
})

test('a direct link to a tool opens it', async ({ page }) => {
  const response = await page.goto('./sign/')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign' })).toBeVisible()
})

test('the theme follows the toggle and survives a reload', async ({ page }) => {
  await page.goto('./')
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await page.getByRole('button', { name: /Switch to (dark|light) theme/ }).click()
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(!dark)
})
