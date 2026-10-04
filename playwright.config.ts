import { defineConfig, devices } from '@playwright/test'

// End-to-end runs against the production build under the same base path as Pages.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4310/pdf-lab/' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4310 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4310/pdf-lab/',
    env: { GITHUB_PAGES: 'true' },
    reuseExistingServer: !process.env.CI,
  },
})
