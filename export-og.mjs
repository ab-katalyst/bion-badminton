// Renders og-image.html -> og-image.png at exact 1200x630
import { execSync } from 'node:child_process';
const pw = await import(`${execSync('npm root -g').toString().trim()}/playwright/index.js`);
const chromium = (pw.default ?? pw).chromium;

const dir = import.meta.dirname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto(`file://${dir}/og-image.html`, { waitUntil: 'load' });
await page.waitForTimeout(200);
await page.screenshot({ path: `${dir}/og-image.png`, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('done: og-image.png');
