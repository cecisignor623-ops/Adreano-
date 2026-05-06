# Kit de Criativos — Heranças Invisíveis

Kit pronto pra rodar no Meta Ads. Você não precisa de designer pra começar
— os HTMLs renderizam com a mesma estética da landing (preto/dourado,
fontes Cormorant + Inter) e são "screenshot-ready".

## 📁 Conteúdo da pasta

| Arquivo | Formato | Ângulo |
|---|---|---|
| `COPIES.md` | Markdown | **5 textos prontos** pra colar no Ads Manager |
| `feed-01-quote.html` | 1080×1080 | Quote sofisticado, alta tensão |
| `feed-02-photo.html` | 1080×1080 | Foto do Adreano + overlay |
| `feed-03-revelation.html` | 1080×1080 | Frase de impacto centralizada |
| `feed-04-checklist.html` | 1080×1080 | 5 dores em formato lista |
| `feed-05-question.html` | 1080×1080 | Pergunta gigante + resposta |
| `story-01-photo.html` | 1080×1920 | Story vertical com foto |
| `story-02-question.html` | 1080×1920 | Story vertical + pergunta |
| `adreano.jpg` | imagem | Foto do palestrante (já usada nos templates) |

---

## 🎯 Como exportar cada template como imagem (5 minutos)

### Método 1 — Chrome DevTools (recomendado, mais limpo)

1. **Abre o arquivo no Chrome:** `Ctrl+O` → seleciona `feed-01-quote.html`
2. **Abre DevTools:** `F12` (ou `Ctrl+Shift+I`)
3. Click no ícone de **Toggle device toolbar** (ou aperta `Ctrl+Shift+M`)
4. No topo, escolhe **"Responsive"** e digita as dimensões exatas:
   - Para feeds quadrados: **1080 × 1080**
   - Para stories: **1080 × 1920**
5. **Zoom 100%** (controle no topo direito do device toolbar)
6. **Captura full page:**
   - No menu de 3 pontinhos do device toolbar (⋮) → **"Capture screenshot"** (ou `Ctrl+Shift+P` → digita "screenshot" → "Capture full size screenshot")
7. Salva o PNG/JPG

### Método 2 — Print de tela manual (rápido, sem DevTools)

1. Abre o HTML no Chrome em janela maximizada
2. Aperta **`Ctrl+0`** pra reset de zoom
3. Print de tela: **`Win+Shift+S`** → seleciona só a parte do anúncio (a moldura quadrada/vertical)
4. Cola num editor de imagem (ou direto no Ads Manager) e salva

⚠️ **Importante:** o template tem **1080×1080 px reais**. Se sua tela é menor, vai aparecer com scroll — use o **Método 1** (DevTools) pra capturar em tamanho real.

### Método 3 — Use uma ferramenta (mais polido)

Se preferir editar/refinar antes de subir:

- **HTML to Image** (htmlcsstoimage.com): cola o HTML, baixa PNG. Tem free tier.
- **Capture Full Page** (extensão Chrome): captura page inteira em PNG.
- **Screely** (screely.com): pra mockups mais elaborados.

---

## 📋 Recomendação de exportação

Pra cada template, exporta em **3 formatos**:

| Formato Meta | Dimensão | Onde aparece |
|---|---|---|
| **Quadrado 1:1** | 1080×1080 | Feed Facebook + Feed Instagram |
| **Vertical 4:5** | 1080×1350 | Feed Instagram (preferido — ocupa mais espaço) |
| **Stories/Reels 9:16** | 1080×1920 | Stories, Reels, Explore |

**Atalho:** os templates `feed-*.html` são todos 1:1. Pros 4:5 e 9:16, use os
templates `story-*.html` (que já são 9:16) ou faça crop manual no
Photoshop/Canva pra 4:5 (recortar 270px de cada lado superior/inferior).

---

## 🚀 Estratégia de uso no Ads Manager

### Setup mínimo viável (lançamento hoje)

1. **1 Campanha** com objetivo **`Vendas`** otimizando **`Compra`**
2. **2 Ad Sets** (rodam em paralelo):
   - **Ad Set A:** Maringá+50km · 28-58 anos · Interesses (psicologia, autoconhecimento, constelação familiar, terapia sistêmica, espiritualidade)
   - **Ad Set B:** Maringá+50km · 30-55 anos · **Sem interesses** (Advantage Detailed Targeting Expansion ligado — Meta otimiza)
3. **5 Ads em cada Ad Set**, um por copy + visual:

| Ad | Copy | Visual quadrado | Visual story |
|---|---|---|---|
| Ad 1 | Copy 1 (Padrão) | feed-01-quote | story-01-photo |
| Ad 2 | Copy 2 (Revelação) | feed-03-revelation | story-02-question |
| Ad 3 | Copy 3 (Checklist) | feed-04-checklist | story-01-photo |
| Ad 4 | Copy 4 (Pergunta) | feed-05-question | story-02-question |
| Ad 5 | Copy 5 (Honesto) | feed-02-photo | story-01-photo |

### Orçamento sugerido

- **Início:** R$ 30/dia por Ad Set = **R$ 60/dia total** (~R$ 420/semana)
- **Após 5 dias com dados:** pausa Ads ruins, aumenta nos vencedores
- **Se ROAS > 3.0:** dobra o budget. Se ROAS < 1.5: revisa público + criativo

### Janela de campanha

- **Início:** ASAP (hoje se possível)
- **Final:** 18 de maio de 2026 (2 dias antes do evento)
- Total: 2 semanas de teste/escala

---

## 🎨 Próxima fase — quando tiver budget pra elevar o nível

Os templates HTML são "starter pack" — funcionam mas não substituem
um designer. Quando ROAS estabilizar, considera:

1. **Vídeo curto (15s)** com Adreano falando — ainda mais conversão
2. **Carrossel** mostrando 5 frames de dor + 1 CTA
3. **Stories interativos** com quiz "Que padrão você herdou?"
4. **Re-targeting** pra quem viu landing mas não comprou (criativos com
   tom de urgência, scarcity, depoimentos quando tiver)
