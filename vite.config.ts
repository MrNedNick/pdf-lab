import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vitest/config'
import { SITE_DESCRIPTION, TOOLS, titleFor, type Tool } from './src/tools.ts'

const SITE = 'https://mrnednick.github.io/pdf-lab/'

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** The page's head for one address: its own title, description, canonical URL and link preview. */
function headFor(html: string, tool?: Tool): string {
  const title = escape(titleFor(tool))
  const description = escape(tool?.description ?? SITE_DESCRIPTION)
  const url = `${SITE}${tool ? `${tool.slug}/` : ''}`
  return html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
}

/**
 * GitHub Pages serves files, not routes: every tool gets its own copy of
 * index.html with its own title and link preview, so a direct link answers
 * 200 and reads right when shared; 404.html catches the rest.
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
      const html = readFileSync(index, 'utf8')
      writeFileSync(index, headFor(html))
      for (const tool of TOOLS) {
        mkdirSync(resolve(outDir, tool.slug), { recursive: true })
        writeFileSync(resolve(outDir, tool.slug, 'index.html'), headFor(html, tool))
      }
      writeFileSync(resolve(outDir, '404.html'), headFor(html))
    },
  }
}

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/pdf-lab/' : '/',
  plugins: [react(), tailwindcss(), { name: 'site-head', transformIndexHtml: (html) => headFor(html) }, pagesFallback()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
