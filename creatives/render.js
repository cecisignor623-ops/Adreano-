// Renderiza todos os HTMLs de criativos em PNG com tamanho exato.
// Uso: node creatives/render.js

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEMPLATES = [
  { html: 'feed-01-quote.html',     out: 'feed-01-quote.png',     w: 1080, h: 1080 },
  { html: 'feed-02-photo.html',     out: 'feed-02-photo.png',     w: 1080, h: 1080 },
  { html: 'feed-03-revelation.html',out: 'feed-03-revelation.png',w: 1080, h: 1080 },
  { html: 'feed-04-checklist.html', out: 'feed-04-checklist.png', w: 1080, h: 1080 },
  { html: 'feed-05-question.html',  out: 'feed-05-question.png',  w: 1080, h: 1080 },
  { html: 'story-01-photo.html',    out: 'story-01-photo.png',    w: 1080, h: 1920 },
  { html: 'story-02-question.html', out: 'story-02-question.png', w: 1080, h: 1920 },
];

(async () => {
  const dir = __dirname;
  console.log('Iniciando navegador headless...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const t of TEMPLATES) {
    const page = await browser.newPage();
    await page.setViewport({ width: t.w, height: t.h, deviceScaleFactor: 1 });

    const fileUrl = 'file:///' + path.join(dir, t.html).replace(/\\/g, '/');
    console.log(`Renderizando ${t.html} (${t.w}x${t.h})...`);

    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    // Aguarda fontes Google carregarem completamente
    await page.evaluateHandle('document.fonts.ready');

    // Screenshot só da área do .ad (que é exatamente W x H)
    const adElement = await page.$('.ad');
    if (adElement) {
      await adElement.screenshot({
        path: path.join(dir, t.out),
        type: 'png',
        omitBackground: false,
      });
    } else {
      // fallback: screenshot da viewport inteira
      await page.screenshot({
        path: path.join(dir, t.out),
        type: 'png',
        clip: { x: 0, y: 0, width: t.w, height: t.h },
      });
    }

    const stats = fs.statSync(path.join(dir, t.out));
    console.log(`  → ${t.out} (${(stats.size / 1024).toFixed(1)} KB)`);
    await page.close();
  }

  await browser.close();
  console.log('\nPronto! 7 PNGs gerados em creatives/');
})().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
