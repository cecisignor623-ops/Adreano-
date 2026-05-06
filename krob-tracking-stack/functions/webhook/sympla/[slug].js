// -----------------------------------------------------------------------------
// Sympla webhook adapter.
//
// URL shape: /webhook/sympla/<SYMPLA_WEBHOOK_SLUG>
// The per-recipient UUID stored in env.SYMPLA_WEBHOOK_SLUG gates the endpoint;
// scanners hitting /webhook/sympla without the right slug get a 404.
//
// Platform specifics (best-effort v0 — see docs/platforms/sympla.md):
//   - Sympla does NOT have a first-class custom-tracking field. The closest
//     mechanism is the URL `?ref=` parameter (originally affiliate tracking),
//     which Sympla MAY include in the webhook payload as `data.ref`. The
//     adapter tries multiple paths and degrades gracefully when missing.
//   - Sympla webhook payload uses snake_case fields, sometimes nested under
//     `data` and sometimes under `order` depending on webhook config version.
//   - Status codes can be single letters ("A"/"P"/"S"/"C") or full words
//     ("APPROVED"/"PAID"/"PENDING"/"CANCELLED"). The adapter normalizes both.
//   - Buyer name is split into first/last; reconstructed before passing to
//     _core.js (which re-splits for Meta CAPI).
//   - UTMs are NOT carried in the webhook — attribution comes from the
//     `checkout_sessions` lookup via `trk` (when available).
//
// IMPORTANT: This adapter was written before capturing a real Sympla payload.
// After the first real test, verify field paths and tighten the parser if any
// field comes back empty. Update docs/platforms/sympla.md to match reality.
// -----------------------------------------------------------------------------

import { processPurchase } from '../_core.js';
import { guardSlug } from '../_utils.js';

// Status values that indicate a paid/approved purchase (case-insensitive).
const PAID_STATUSES = new Set(['A', 'P', 'APPROVED', 'PAID', 'COMPLETED']);

// Helper: walk a nested object via array of paths, return first non-empty value
function pickFirst(obj, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => {
      if (acc == null) return undefined;
      return acc[key];
    }, obj);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

// Helper: parse Sympla price into a decimal number.
// Sympla typically sends decimal (97.00) but some fields come as strings.
function parsePrice(raw) {
  if (raw == null) return 0;
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw).replace(/[^\d.,-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export async function onRequestPost(context) {
  const { request, env, params } = context;

  const slugFailure = guardSlug(params.slug, env.SYMPLA_WEBHOOK_SLUG);
  if (slugFailure) return slugFailure;

  try {
    const rawPayload = await request.json();

    // Sympla wraps the payload in a few different shapes depending on
    // webhook config version. Try common nestings.
    const body =
      rawPayload.data ||
      rawPayload.order ||
      rawPayload;

    // Filter to paid events. Status field is in different paths across
    // Sympla's webhook versions; try them in order.
    const rawStatus = pickFirst(body, [
      'order_status',
      'status',
      'transaction.status',
      'order.status',
    ]) || pickFirst(rawPayload, ['order.status', 'status']);

    const normalizedStatus = String(rawStatus || '').toUpperCase().trim();

    if (!PAID_STATUSES.has(normalizedStatus)) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: 'not a paid order',
          status: normalizedStatus || 'unknown',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ---- Extract fields with defensive fallback paths ----

    const trk = String(
      pickFirst(body, ['ref', 'affiliate.code', 'tracking_code', 'custom_field']) ||
        pickFirst(rawPayload, ['ref', 'order.ref']) ||
        ''
    );

    const email = String(
      pickFirst(body, ['buyer_email', 'buyer.email', 'email', 'customer.email']) ||
        ''
    ).toLowerCase().trim();

    const firstName = String(pickFirst(body, ['buyer_first_name', 'buyer.first_name']) || '').trim();
    const lastName = String(pickFirst(body, ['buyer_last_name', 'buyer.last_name']) || '').trim();
    const fullNameFromParts = [firstName, lastName].filter(Boolean).join(' ');
    const name = fullNameFromParts ||
      String(pickFirst(body, ['buyer_name', 'buyer.name', 'name', 'customer.name']) || '').trim();

    const phone = String(
      pickFirst(body, ['buyer_phone', 'buyer.phone', 'phone', 'customer.phone', 'buyer.cellphone']) ||
        ''
    ).trim();

    const value = parsePrice(
      pickFirst(body, [
        'transaction_value',
        'order_total',
        'total_value',
        'amount',
        'value',
        'price.value',
      ])
    );

    const currency = String(
      pickFirst(body, ['currency', 'currency_code', 'price.currency']) || 'BRL'
    ).toUpperCase();

    const transactionId = String(
      pickFirst(body, [
        'transaction_id',
        'order_identifier',
        'order_id',
        'id',
        'transaction.id',
      ]) || ''
    );

    const productId = String(
      pickFirst(body, ['event_id', 'event.id', 'product_id']) ||
        pickFirst(rawPayload, ['event.id']) ||
        ''
    );

    const productName = String(
      pickFirst(body, ['event_name', 'event.name', 'product_name']) ||
        pickFirst(rawPayload, ['event.name']) ||
        ''
    ).trim();

    // Map Sympla tickets to normalized items array.
    // Each ticket becomes a purchase item for accurate per-product reporting.
    const ticketsArray = Array.isArray(body.tickets)
      ? body.tickets
      : Array.isArray(body.items)
      ? body.items
      : [];

    let items = ticketsArray.map((t) => ({
      productId: String(t.ticket_identifier || t.id || productId || ''),
      name: t.ticket_name || t.name || productName || '',
      price: {
        value: parsePrice(t.ticket_value ?? t.value ?? t.price?.value ?? value),
        currency: t.currency || currency,
      },
      quantity: t.quantity || 1,
    }));

    // Fallback: if no tickets array, synthesize a single line item from
    // the order-level fields so purchase_items still gets populated.
    if (items.length === 0 && (productId || value > 0)) {
      items = [
        {
          productId,
          name: productName,
          price: { value, currency },
          quantity: 1,
        },
      ];
    }

    const parsed = {
      platform: 'sympla',
      trk,
      email,
      name,
      phone,
      value,
      currency,
      transactionId,
      productId,
      productName,
      items,
      // Sympla doesn't carry UTMs in webhook payload. Pass empty so _core.js
      // falls back to the checkout_sessions lookup (when trk is present).
      platformUtm: {
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        utm_content: '',
        utm_term: '',
      },
    };

    const result = await processPurchase({ parsed, env, context });

    return new Response(
      JSON.stringify({ ok: true, event_id: result.eventId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Sympla webhook error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
