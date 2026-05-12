// -----------------------------------------------------------------------------
// Sympla → Meta CAPI sync
//
// Polls the Sympla orders API for paid orders, then fires Purchase events to
// Meta's Conversions API (CAPI) for orders we haven't processed yet. Stores
// processed order IDs in a local JSON file to avoid duplicates.
//
// Usage:
//   node scripts/sympla-sync.js           # processes new orders
//   node scripts/sympla-sync.js --reset   # clears processed_orders.json
//   node scripts/sympla-sync.js --dry-run # logs what would be sent, no API call
//
// Reads from .env:
//   SYMPLA_API_TOKEN      (required)
//   META_PIXEL_ID         (required)
//   META_ACCESS_TOKEN     (required)
//   META_TEST_EVENT_CODE  (optional — só pra testes em Events Manager)
//
// Hardcoded:
//   SYMPLA_EVENT_ID = 3372889 (Heranças Invisíveis)
// -----------------------------------------------------------------------------

require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SYMPLA_EVENT_ID = 3372889;
const SYMPLA_API_TOKEN = process.env.SYMPLA_API_TOKEN;
const META_PIXEL_ID = process.env.META_PIXEL_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE; // opcional

const PROCESSED_FILE = path.join(__dirname, '..', 'data', 'processed_orders.json');

const DRY_RUN = process.argv.includes('--dry-run');
const RESET = process.argv.includes('--reset');

// SHA-256 hashing per Meta CAPI spec (lowercase + trim antes)
function sha256(value) {
  if (!value) return '';
  const normalized = String(value).toLowerCase().trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function normalizePhone(phone, countryCode = '55') {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith(countryCode) ? digits : countryCode + digits;
}

function loadProcessed() {
  try {
    if (!fs.existsSync(PROCESSED_FILE)) return {};
    return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
  } catch (e) {
    console.warn('Erro ao ler processed_orders.json:', e.message);
    return {};
  }
}

function saveProcessed(processed) {
  const dir = path.dirname(PROCESSED_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processed, null, 2));
}

async function fetchSymplaOrders() {
  const url = `https://api.sympla.com.br/public/v3/events/${SYMPLA_EVENT_ID}/orders?page_size=200`;
  const res = await fetch(url, { headers: { 's_token': SYMPLA_API_TOKEN } });
  if (!res.ok) throw new Error(`Sympla API erro ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data || [];
}

async function sendPurchaseToMeta(order) {
  const hashedEm = sha256(order.buyer_email);
  const hashedFn = sha256(order.buyer_first_name);
  const hashedLn = sha256(order.buyer_last_name);
  const hashedPh = sha256(normalizePhone(order.buyer_phone));

  const value = parseFloat(order.order_total_sale_price) || 0;
  const orderDate = order.order_approved_date || order.order_date;
  const eventTime = orderDate
    ? Math.floor(new Date(orderDate.replace(' ', 'T') + '-03:00').getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  const userData = {
    em: [hashedEm],
  };
  if (hashedFn) userData.fn = [hashedFn];
  if (hashedLn) userData.ln = [hashedLn];
  if (hashedPh) userData.ph = [hashedPh];

  const customData = {
    value,
    currency: 'BRL',
    content_type: 'product',
    content_ids: [String(SYMPLA_EVENT_ID)],
    content_name: 'Heranças Invisíveis',
    num_items: 1,
  };

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: eventTime,
      event_id: 'sympla-' + order.id, // dedup key
      event_source_url: 'https://www.sympla.com.br/evento/herancas-invisiveis-os-padroes-familiares-que-controlam-sua-vida/' + SYMPLA_EVENT_ID,
      action_source: 'website',
      user_data: userData,
      custom_data: customData,
    }],
  };

  if (META_TEST_EVENT_CODE) {
    payload.test_event_code = META_TEST_EVENT_CODE;
  }

  if (DRY_RUN) {
    console.log('  [DRY RUN] Payload pronto, não envia:');
    console.log('  ', JSON.stringify(customData));
    return { dryRun: true, payload };
  }

  const url = `https://graph.facebook.com/v25.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  return { status: res.status, ok: res.ok, body };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  if (!SYMPLA_API_TOKEN || !META_PIXEL_ID || !META_ACCESS_TOKEN) {
    console.error('ERRO: Faltam variaveis no .env (SYMPLA_API_TOKEN, META_PIXEL_ID, META_ACCESS_TOKEN)');
    process.exit(1);
  }

  if (RESET) {
    if (fs.existsSync(PROCESSED_FILE)) fs.unlinkSync(PROCESSED_FILE);
    console.log('Arquivo processed_orders.json removido.');
    return;
  }

  console.log('Sympla Sync · evento ' + SYMPLA_EVENT_ID + (DRY_RUN ? ' [DRY RUN]' : ''));
  console.log('--------------------------------------------------');

  let processed = loadProcessed();
  console.log('Já processados anteriormente: ' + Object.keys(processed).length + ' pedidos');

  let orders;
  try {
    orders = await fetchSymplaOrders();
  } catch (e) {
    console.error('Erro ao consultar Sympla:', e.message);
    process.exit(1);
  }

  console.log('Pedidos retornados pela Sympla: ' + orders.length);

  // Filtra só os aprovados/pagos
  const approved = orders.filter(o => o.order_status === 'A' || o.order_status === 'P');
  console.log('Aprovados (status A ou P): ' + approved.length);

  const newOrders = approved.filter(o => !processed[o.id]);
  console.log('Novos a processar: ' + newOrders.length);

  if (newOrders.length === 0) {
    console.log('\nNada novo. Sincronizado.');
    return;
  }

  let okCount = 0, errCount = 0;
  for (const order of newOrders) {
    console.log('\n→ Order ' + order.id + ' · ' + order.buyer_email + ' · R$ ' + order.order_total_sale_price + ' · status ' + order.order_status);
    try {
      const result = await sendPurchaseToMeta(order);
      if (result.dryRun) {
        okCount++;
        continue;
      }
      if (result.ok && result.body && result.body.events_received >= 1) {
        console.log('  ✅ Meta CAPI ok · events_received: ' + result.body.events_received + ' · fbtrace_id: ' + result.body.fbtrace_id);
        processed[order.id] = {
          email: order.buyer_email,
          value: order.order_total_sale_price,
          order_date: order.order_date,
          sent_at: new Date().toISOString(),
          fbtrace_id: result.body.fbtrace_id,
        };
        okCount++;
      } else {
        console.log('  ❌ Meta retornou erro:', JSON.stringify(result.body));
        errCount++;
      }
    } catch (e) {
      console.log('  ❌ Erro:', e.message);
      errCount++;
    }
  }

  if (!DRY_RUN) saveProcessed(processed);

  console.log('\n--------------------------------------------------');
  console.log('Sucesso: ' + okCount + ' · Erros: ' + errCount);
})().catch(e => {
  console.error('Falha geral:', e);
  process.exit(1);
});
