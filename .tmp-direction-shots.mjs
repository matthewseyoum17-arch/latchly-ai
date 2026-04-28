import { chromium } from 'playwright';

const OUT = '/tmp/moms-og-rebuild/directions';
const dirs = ['pentagram', 'build', 'takram'];

const browser = await chromium.launch();
for (const name of dirs) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const url = `file://${OUT}/${name}.html`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false, timeout: 60000 });
  console.log(`shot: ${name}.png`);
  await ctx.close();
}
await browser.close();
console.log('done');
