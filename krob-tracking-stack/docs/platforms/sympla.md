# Sympla

Brazilian event-ticketing platform (sympla.com.br). Used for selling
tickets to live or virtual events.

> ⚠️ **STATUS: Best-effort v0.** This doc was written from public
> Sympla webhook documentation patterns; we have NOT yet captured a
> real production payload. The adapter is defensive (multiple field
> paths with fallbacks) but will need to be tightened once we see
> the actual JSON Sympla sends. After the first real test, update
> this doc to match reality and tighten the adapter accordingly.

---

## Identity

- **Platform name**: Sympla
- **Webhook endpoint**: `/webhook/sympla/<SYMPLA_WEBHOOK_SLUG>`
- **Adapter file**: `functions/webhook/sympla/[slug].js`
- **Sandbox availability**: No formal sandbox. Sympla offers a "Webhook
  test" button in the producer dashboard that fires a sample payload.
  For end-to-end testing with real payment flow, use a 100%-off coupon
  on a published event.
- **Dashboard URL**: `https://www.sympla.com.br/produtor/integracoes`
  (Producer Panel → Integrations → Webhooks).

## Endpoint security — obscure URL

Standard obscure-URL pattern: `env.SYMPLA_WEBHOOK_SLUG` is a UUID v4
that gates the endpoint. Wrong slug → 404.

Sympla webhooks DO support a static **shared secret token** that the
producer configures in the dashboard, sent as a header on each request.
We are NOT verifying it in v1. To enable later (in `harden-tracking`):

- **Header name**: `X-SYMPLA-TOKEN` (configurable in producer dashboard)
- **Algorithm**: Static bearer token comparison (no HMAC computed)
- **What is signed**: Nothing — just a shared secret
- **Recipient dashboard path for the secret**: Producer Panel → Integrations
  → Webhooks → "Secret token" field

## The `trk` field

Sympla does NOT have a first-class custom-tracking field that
round-trips through the webhook payload reliably. The closest mechanism
is the `?ref=` URL parameter (originally for affiliate tracking) — some
Sympla webhook configurations include `ref` in the order payload when
the buyer arrived via a URL with `?ref=<value>`.

- **URL parameter name on checkout URL**: `ref`
- **Webhook payload field path** (best guess, multiple fallbacks tried):
  - `body.data.ref`
  - `body.data.affiliate.code`
  - `body.order.ref`
  - `body.ref`
- **Character-set constraints**: Sympla's `ref` field accepts
  alphanumeric strings up to ~50 chars based on observed behavior. A
  full UUID v4 (36 chars including dashes) should pass through, but
  test with a known UUID to confirm round-trip integrity.

> **Fallback strategy**: If `ref` is empty (i.e., user came via direct
> link or organic), the adapter still processes the purchase and fires
> Meta CAPI using the buyer's email + IP for Advanced Matching. Match
> Quality is lower (no fbp/fbc) but the conversion still attributes.

## Payload shape

⚠️ **Schema below is best-effort, based on Sympla's public webhook
docs**. Real payload may differ. Fields with `?` are uncertain and the
adapter tries multiple paths.

```json
{
  "type": "ORDER",
  "data": {
    "order_identifier": "ABCXYZ123",
    "order_status": "A",
    "order_date": "2026-05-06 15:30:00",
    "transaction_id": "TXN789",
    "transaction_value": 97.00,
    "discount_value": 0,
    "discount_code": "",
    "order_payment_method": "credit_card",
    "buyer_first_name": "Fulano",
    "buyer_last_name": "Silva",
    "buyer_email": "fulano@example.com",
    "buyer_phone": "11999999999",
    "buyer_document": "12345678900",
    "event_id": 3372889,
    "event_name": "Heranças Invisíveis — Os Padrões Familiares...",
    "event_url": "https://www.sympla.com.br/evento/...",
    "tickets": [
      {
        "ticket_identifier": "T001",
        "ticket_number": "12345",
        "ticket_name": "Ingresso Único",
        "ticket_value": 97.00,
        "ticket_status": "A"
      }
    ],
    "ref": null
  }
}
```

Normalized-field mapping (with adapter fallback paths):

| Normalized field | Primary path | Fallback paths |
|---|---|---|
| `trk` | `body.data.ref` | `body.data.affiliate.code`, `body.order.ref`, `body.ref` |
| `email` | `body.data.buyer_email` | `body.data.buyer.email`, `body.buyer.email` |
| `name` | `body.data.buyer_first_name + ' ' + body.data.buyer_last_name` | `body.data.buyer.name`, `body.buyer.name` |
| `phone` | `body.data.buyer_phone` | `body.data.buyer.phone`, `body.buyer.phone` (or `''`) |
| `value` | `body.data.transaction_value` (decimal) | `body.data.order_total`, `body.order.total_value` |
| `currency` | `body.data.currency` | hardcoded `'BRL'` |
| `transactionId` | `body.data.transaction_id` | `body.data.order_identifier`, `body.data.id` |
| `productId` | `String(body.data.event_id)` | `String(body.data.event.id)`, `String(body.event.id)` |
| `productName` | `body.data.event_name` | `body.data.event.name`, `body.event.name` |
| `items[]` | `body.data.tickets[]` mapped to `{productId, name, price, quantity}` | Synthesized from event + value |
| `platformUtm.utm_source` | not provided by Sympla | `''` (UTMs come from `checkout_sessions` lookup via `trk`) |

## Paid-sale filter

Sympla's `order_status` uses single-letter codes (sometimes; full words
in newer webhooks). The adapter accepts both formats and only processes
the paid statuses.

- **Paid status values** (case-insensitive):
  - `'A'` or `'APPROVED'` → approved/paid
  - `'P'` or `'PAID'` → paid (some Sympla setups distinguish)
- **Status field paths tried**:
  - `body.data.order_status`
  - `body.data.status`
  - `body.order.status`
  - `body.status`
- **Other statuses to acknowledge-and-skip**:
  - `'S'` / `'PENDING'` → pending payment (boleto, pix waiting confirmation)
  - `'C'` / `'CANCELLED'` → buyer cancelled before payment
  - `'R'` / `'REFUNDED'` → refunded after the fact (out of scope for v1)
  - `'D'` / `'DECLINED'` → card declined

## Known gotchas

- **No native UTMs in webhook**: Sympla does NOT forward UTM parameters
  in the webhook payload, even if the buyer arrived via a URL with
  UTMs. UTM attribution must come from `checkout_sessions` lookup via
  `trk` (which routes through the `?ref=` mechanism).
- **Phone format inconsistent**: Sympla collects phone as a free-text
  field. Brazilian numbers commonly come as `11999999999` (no
  country code, no symbols) or `(11) 99999-9999`. The `_core.js`
  hashing pipeline handles this via `normalizePhone()` with the
  `DEFAULT_COUNTRY_CODE` env var (default `55`).
- **Name split into first/last**: Unlike Eduzz/Hotmart that send a
  single `name`, Sympla splits buyer name into `buyer_first_name` +
  `buyer_last_name`. The adapter reconstructs the full name and
  `_core.js` re-splits for Meta (em + fn + ln).
- **Multiple tickets per order**: A single order can buy N tickets to
  the same event, or tickets to different sub-types. The adapter maps
  every entry in `tickets[]` into `purchase_items` for accurate
  per-product reporting.
- **Retry behavior**: Sympla retries failed webhooks (non-2xx response)
  up to 5 times with exponential backoff over ~24 hours. The adapter
  must return 200 even for skipped events to stop the retry loop.
- **Webhook config UI hidden**: Webhook configuration is buried under
  Producer Panel → Integrations → Webhooks (sometimes labeled "API"
  depending on Sympla's UI version). Producers may need to enable the
  "API access" feature on their account first.
- **Test webhook sample is minimal**: Sympla's "Send test" button fires
  a payload with placeholder values that may not match the real shape.
  Don't write the parser solely against the test payload — capture a
  real one (100%-off coupon purchase) for source-of-truth.

## Verification test

1. Confirm `SYMPLA_WEBHOOK_SLUG` env var is set in Cloudflare Pages
   project settings.
2. Confirm the project is deployed and the URL responds:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" \
     https://<project>.pages.dev/webhook/sympla/wrong-slug
   ```
   Expected: `404` (gate is working).
3. In the Sympla producer dashboard, configure webhook URL:
   ```
   https://<project>.pages.dev/webhook/sympla/<SYMPLA_WEBHOOK_SLUG>
   ```
   Subscribe to events: `ORDER` (paid orders) at minimum.
4. Click "Send test webhook" in the Sympla dashboard.
5. Check Cloudflare Workers logs for the adapter invocation
   (Pages project → Functions → Logs, filter for `/webhook/sympla/`).
6. Query D1 for the new row:
   ```bash
   wrangler d1 execute <db> --remote --command \
     "SELECT transaction_id, trk, value, currency, raw_email, meta_response_ok, meta_response_body FROM purchase_log ORDER BY created_at DESC LIMIT 1"
   ```
7. Confirm:
   - `transaction_id` matches the test order ID
   - `value` and `currency` correct (97.00 BRL)
   - `raw_email` matches the test buyer email
   - `meta_response_ok = 1` (Meta CAPI accepted the event)
8. **If any field is empty or wrong**: capture the raw webhook payload
   from Cloudflare logs, paste it here in this doc's "Payload shape"
   section, and tighten the adapter's parser to match.
9. End-to-end with real payment flow: create a 100%-off coupon on the
   live event, complete a purchase, repeat steps 5-7.
