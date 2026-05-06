# Adreano

Monorepo do palestrante **Adreano Vitor de Lima**.

## Estrutura

```
adreano/
├── herancas-invisiveis/     # Landing page do evento Heranças Invisíveis (Maringá-PR · 20/05/2026)
└── krob-tracking-stack/     # Backend de tracking server-side (Cloudflare Pages + D1)
```

### `herancas-invisiveis/`

Landing page estática do evento. Deploy via Cloudflare Pages, sem build step.

- `index.html` — landing completa (hero, dor, benefícios, oferta, FAQ, garantia)
- `assets/images/` — imagens do palestrante e do evento
- Tracking client-side: Meta Pixel + captura de UTMs/fbp/fbc + InitiateCheckout no clique do CTA

### `krob-tracking-stack/`

Stack de tracking server-side baseado no projeto open-source [krob-tracking-stack](https://github.com/gustavokrob/krob-tracking-stack) de Gustavo Krob, adaptado para receber webhook da **Sympla** (em vez de Hotmart/Eduzz/Kiwify) e disparar conversões via Meta Conversions API (CAPI).

- Cloudflare Pages Functions
- D1 database para persistência de leads/conversões
- Endpoint customizado `functions/webhooks/sympla.js` (a ser adicionado)

## Setup local

1. Copie o template de variáveis:
   ```bash
   cp .env.example .env
   ```
2. Edite o `.env` direto no editor de texto, preenchendo os valores reais.
3. **NUNCA** commite o `.env`. **NUNCA** cole o token em chat ou em mensagens.

## Deploy

- **Landing** (`herancas-invisiveis/`) → Cloudflare Pages (estático)
- **Tracking** (`krob-tracking-stack/`) → Cloudflare Pages com Functions + D1

Detalhes de deploy em cada subpasta.

## Licença

Privado. Uso interno.
