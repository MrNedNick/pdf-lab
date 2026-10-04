// Draws public/og.png, the 1200 × 630 picture shown when a PDF Lab link is shared.
// Run: node scripts/make-og.mjs
import { chromium } from '@playwright/test'

const tools = ['Sign', 'Edit', 'Merge', 'Split', 'Compress', 'Convert']
const html = `<!doctype html><html><body style="margin:0">
<div style="width:1200px;height:630px;box-sizing:border-box;padding:84px 96px;background:#0f1115;color:#f3f4f6;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column">
  <div style="font-size:34px;font-weight:600;color:#8ea2ff">PDF Lab</div>
  <div style="margin-top:28px;font-size:68px;font-weight:700;line-height:1.08;letter-spacing:-1.5px;max-width:960px">
    PDF tools that never upload your files</div>
  <div style="margin-top:auto;display:flex;gap:14px;flex-wrap:wrap">
    ${tools.map((t) => `<span style="font-size:28px;padding:12px 24px;border-radius:999px;border:2px solid #2d3340;background:#171a21">${t}</span>`).join('')}
  </div>
  <div style="margin-top:28px;font-size:26px;color:#9aa3b2">Free · runs in your browser · no sign-up</div>
</div></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.screenshot({ path: new URL('../public/og.png', import.meta.url).pathname })
await browser.close()
