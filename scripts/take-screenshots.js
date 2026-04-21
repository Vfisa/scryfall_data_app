import puppeteer from 'puppeteer-core';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'documentation');
const CHROMIUM = '/Applications/Chromium.app/Contents/MacOS/Chromium';
const APP_URL = 'http://localhost:3000';
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForCardsLoaded(page) {
  await page.waitForFunction(
    () => document.getElementById('loading-overlay')?.classList.contains('hidden'),
    { timeout: 90_000 }
  );
  await sleep(600);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  console.log('Loading app...');
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 90_000 });
  await waitForCardsLoaded(page);

  // 1. Browse tab
  console.log('Screenshot 1: browse tab');
  await page.screenshot({ path: join(OUT_DIR, '01-browse.png') });

  // 2. Card detail modal — Zimone's Experiment (has foil + non-foil 401 mappings)
  console.log('Screenshot 2: card detail');
  await page.evaluate(() => {
    const input = document.getElementById('search-input');
    input.value = "Zimone's Experiment";
    input.dispatchEvent(new Event('input'));
  });
  await sleep(600);
  await page.evaluate(() => {
    const tile = [...document.querySelectorAll('.card-tile')]
      .find(t => t.querySelector('img')?.alt === "Zimone's Experiment");
    tile?.click();
  });
  await sleep(900);
  await page.screenshot({ path: join(OUT_DIR, '02-card-detail.png') });

  // 2b. Card detail — scrolled to show both price charts
  console.log('Screenshot 2b: card detail charts');
  await page.evaluate(() => {
    document.getElementById('price-chart-container')?.scrollIntoView({ block: 'start' });
  });
  await sleep(400);
  await page.screenshot({ path: join(OUT_DIR, '03-card-detail-charts.png') });

  // Close modal + reset
  await page.evaluate(() => {
    document.getElementById('modal-close')?.click();
    const input = document.getElementById('search-input');
    input.value = '';
    input.dispatchEvent(new Event('input'));
  });
  await sleep(300);

  // 3. TCGPlayer (analytics) tab
  console.log('Screenshot 4: TCGPlayer analytics');
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="analytics"]')?.click());
  await sleep(1500);
  await page.screenshot({ path: join(OUT_DIR, '04-tcgplayer-analytics.png'), fullPage: true });

  // 4. 401 tab
  console.log('Screenshot 5: 401 analytics');
  await page.evaluate(() => document.querySelector('.tab-btn[data-tab="401"]')?.click());
  await sleep(1500);
  await page.screenshot({ path: join(OUT_DIR, '05-401-analytics.png'), fullPage: true });

  await browser.close();
  console.log('Done. Screenshots saved to', OUT_DIR);
})();
