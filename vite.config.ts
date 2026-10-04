import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'
import { SLUGS } from './src/tools.ts'

/**
 * GitHub Pages serves files, not routes: every tool gets its own copy of
 * index.html, so a direct link answers 200, and 404.html catches the rest.
 */
function pagesFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'pages-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const index = resolve(outDir, 'index.html')
      for (const slug of SLUGS) {
        mkdirSync(resolve(outDir, slug), { recursive: true })
        copyFileSync(index, resolve(outDir, slug, 'index.html'))
      }
      copyFileSync(index, resolve(outDir, '404.html'))
    },
  }
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/pdf-lab/' : '/',
  plugins: [react(), tailwindcss(), pagesFallback()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
