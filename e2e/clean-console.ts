import { expect, test as base } from '@playwright/test'

/** Every test fails on a console error or an uncaught exception, not only on what it asserts. */
export const test = base.extend<{ consoleErrors: void }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      page.on('pageerror', (error) => errors.push(error.message))
      await use()
      expect(errors).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
