# PDF Lab

Free PDF tools that run in your browser — merge, split, organize pages, images ↔ PDF, add text and marks, sign, fill forms, compress. No sign-up, and the file never leaves your device.

Work in progress: the tools are being built one by one.

## Run it

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
GITHUB_PAGES=true npm run build && npm run e2e   # end-to-end on the production build (Playwright)
```

React 19, TypeScript, Vite and Tailwind. PDFs are shown with [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0) and written with [pdf-lib](https://github.com/cantoo-scribe/pdf-lib) (MIT).
