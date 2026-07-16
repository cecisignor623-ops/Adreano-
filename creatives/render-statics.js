const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEMPLATES = [
  { html: 'static-01-confronto.html',  out: 'static-01-confronto.png',  w: 1080, h: 1080 },
  { html: 'static-02-autoridade.html', out: 'static-02-autoridade.png', w: 1080, h: 1080 },
  { html: 'static-03-urgencia.html',   out: 'static-03-urgencia.png',   w: 1080, h: 1080 },
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
    await page.evaluateHandle('document.fonts.ready');
    const adElement = await page.$('.ad');
    if (adElement) {
      await adElement.screenshot({ path: path.join(dir, t.out), type: 'png', omitBackground: false });
    } else {
      await page.screenshot({ path: path.join(dir, t.out), type: 'png', clip: { x: 0, y: 0, width: t.w, height: t.h } });
    }
    const stats = fs.statSync(path.join(dir, t.out));
    console.log(`  -> ${t.out} (${(stats.size / 1024).toFixed(1)} KB)`);
    await page.close();
  }

  await browser.close();
  console.log('\nPronto! 3 PNGs gerados.');
})().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
