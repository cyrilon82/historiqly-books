# How to Create a New Case

Step-by-step guide to adding a new case to HistorIQly Books — from research to EPUB to live payment link.

---

## Project Structure

```
historiqly-books/
├── .env                             # Dev Stripe URLs (test mode → localhost)
├── .env.production                  # Prod Stripe URLs (live mode → books.historiqly.com)
├── public/
│   ├── epub/                        # Generated EPUBs + covers
│   │   ├── covers/
│   │   │   ├── piltdown-man.jpg
│   │   │   └── cardiff-giant.jpg
│   │   ├── piltdown-man.epub
│   │   └── cardiff-giant.epub
│   └── cases/images/                # All case images (shared by web + EPUB)
├── scripts/
│   ├── build-epub.mjs               # Piltdown Man EPUB builder
│   ├── build-epub-cardiff.mjs       # Cardiff Giant EPUB builder
│   ├── generate-cover.mjs           # Reusable cover generator
│   └── polish-epub.mjs              # Reusable EPUB post-processor
├── src/
│   ├── components/
│   │   ├── SubscriptionModal.astro  # Stripe purchase modal
│   │   ├── EmailCapture.astro       # Email gate (free books)
│   │   └── LanternSpotlight.astro   # Visual effects
│   ├── data/books/                  # Book chapter content (TypeScript)
│   │   ├── piltdown-man.ts
│   │   └── cardiff-giant.ts
│   ├── pages/
│   │   ├── cases/                   # Interactive web case pages
│   │   │   ├── piltdown-man.astro   # FREE — email gate
│   │   │   └── cardiff-giant.astro  # PAID — $2.99 Stripe
│   │   ├── vol/
│   │   │   └── hoaxes.astro         # Volume listing page
│   │   └── index.astro              # Homepage
│   └── layouts/
│       └── SidebarLayout.astro      # Shared layout with sidebar nav
└── package.json
```

---

## Existing Books

| # | Book | Slug | Price | Stripe | Status |
|---|------|------|-------|--------|--------|
| 01 | The Piltdown Men | `piltdown-man` | Free (email gate) | N/A | Live |
| 02 | The Cardiff Giant | `cardiff-giant` | $2.99 | Payment Link | Live |

---

## Quick Start — Adding a New Paid Book

For an AI assistant doing this work, here's the exact sequence:

1. **Research** the topic (web search, gather facts, timeline, key figures)
2. **Download images** from Wikimedia Commons (public domain)
3. **Write book content** → `src/data/books/{slug}.ts`
4. **Create EPUB build script** → `scripts/build-epub-{slug}.mjs`
5. **Build the EPUB** → `npm run build:epub:{slug}`
6. **Create the web case page** → `src/pages/cases/{slug}.astro`
7. **Create Stripe product + payment link** (CLI)
8. **Add env variables** for dev/prod Stripe URLs
9. **Update volume page** → `src/pages/vol/hoaxes.astro`
10. **Update package.json** build commands
11. **Build and test** → `npm run build`

---

## Step 1 — Research

Use web search to gather:
- **Full chronological history** of the event
- **Key people** involved (names, roles, dates)
- **Physical details** (measurements, locations, costs)
- **The exposure/resolution** — how and when it was discovered/debunked
- **Current status** — where artifacts are now, what happened to the people

Aim for enough material to write 8 chapters of ~1,500–2,000 words each.

---

## Step 2 — Download Images

### Source: Wikimedia Commons (public domain)

Direct downloads from Wikimedia often get blocked by Cloudflare. Use the **Wikimedia API** instead:

```bash
# 1. Search for images by topic
curl -s "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=Cardiff+Giant&srnamespace=6&srlimit=20&format=json" \
  -H "User-Agent: HistorIQlyBot/1.0 (https://historiqly.com)" | jq '.query.search[].title'

# 2. Get the actual file URL for a specific image
curl -s "https://commons.wikimedia.org/w/api.php?action=query&titles=File:Cardiff_Giant.jpg&prop=imageinfo&iiprop=url&format=json" \
  -H "User-Agent: HistorIQlyBot/1.0 (https://historiqly.com)" | jq '.query.pages[].imageinfo[0].url'

# 3. Download with proper User-Agent
curl -L -o public/cases/images/cardiff-giant.jpg \
  "https://upload.wikimedia.org/wikipedia/commons/..." \
  -H "User-Agent: HistorIQlyBot/1.0 (https://historiqly.com)"
```

### What you need

| Image | Purpose | Format | Notes |
|-------|---------|--------|-------|
| Hero/background | Cover generation + web hero | JPG | High-res, at least 1600px wide |
| Chapter illustrations | Placed after chapter text in EPUB | JPG or PNG | ~1200px wide max |
| Evidence/detail shots | Web evidence cards | JPG | Square or landscape |
| Suspect/figure portraits | Web key figures section | JPG | Portrait orientation, 3:4 ratio |

### Naming convention
```
hero-cardiff-giant-exhumed.jpg    # Hero/cover background
cardiff-giant-closeup.jpg         # Evidence close-up
suspect-othniel-marsh.jpg         # Person portrait (prefix: suspect-)
onondaga-giant-engraving.jpg      # Historical illustration
```

### Image sizing
- The EPUB polish step auto-compresses anything over 500KB
- PNGs over 500KB get converted to JPEG automatically
- Aim for JPG where possible to keep the EPUB under 3MB
- Oversized images (3+ MB from Wikimedia) get compressed 80-98% by polish-epub

---

## Step 3 — Write the Book Content

Create `src/data/books/{slug}.ts`:

```typescript
export const book = {
  title: 'The Cardiff Giant',
  subtitle: 'The Cigar Maker Who Fooled America',
  author: 'HistorIQly',
  series: 'Vol. 1: Hoaxes',
  slug: 'cardiff-giant',
  description: 'One-paragraph hook for metadata.',
  cover: '/cases/images/onondaga-giant-engraving.jpg',
  chapters: [
    {
      num: 'One',                      // Written out: 'One', 'Two', 'Three'...
      title: 'The Argument',            // Chapter title (also used to map images)
      content: `<p>Chapter content in HTML.</p>
<p>Use &lt;p&gt;, &lt;em&gt;, &lt;strong&gt; only.</p>`,
    },
    // ... 7-8 chapters total
  ],
};
```

**Content rules:**
- Each chapter is HTML inside a backtick template literal
- Use only `<p>`, `<em>`, `<strong>` — no divs, no classes, no inline styles
- Aim for 1,500–2,000 words per chapter
- 8 chapters is the sweet spot (Cardiff Giant has 8)
- Write as narrative non-fiction — tell it like a story, not an encyclopedia entry

---

## Step 4 — Create the EPUB Build Script

Duplicate `scripts/build-epub-cardiff.mjs` and modify:

1. Update book metadata (title, subtitle, slug, etc.)
2. Update the `images` map with your image filenames
3. Update the `chapterImages` map to associate images with chapter titles
4. Update the epigraph quote
5. Update the timeline appendix
6. Update the "Further Reading" section

**Key structure:**
```javascript
// Image mapping — keys must match EXACT chapter titles from data file
const chapterImages = {
  'The Argument': figureHtml(images.hero, 'Alt text', 'Caption'),
  'The Block':    figureHtml(images.quarry, 'Alt text', 'Caption'),
  // Chapters without images: just don't add an entry
};
```

### Add to package.json

```json
{
  "scripts": {
    "build": "node scripts/build-epub.mjs && node scripts/build-epub-cardiff.mjs && node scripts/build-epub-{newslug}.mjs && astro build",
    "build:epub": "node scripts/build-epub.mjs && node scripts/build-epub-cardiff.mjs && node scripts/build-epub-{newslug}.mjs",
    "build:epub:{newslug}": "node scripts/build-epub-{newslug}.mjs"
  }
}
```

### Build and test

```bash
npm run build:epub:{slug}
# Output: public/books/{slug}.epub (~1-2MB)
# Cover: public/books/covers/{slug}.jpg (1600x2400)
```

---

## Step 5 — Create the Web Case Page

### Free book (like Piltdown Man)

Duplicate `piltdown-man.astro`. Key elements:
- `<span class="meta-badge preview">FREE</span>` badge
- Hero button links to `/books/#book` (email capture on homepage)
- Conclusion CTA: "Get the Full Book — Free" with download link

### Paid book (like Cardiff Giant)

Duplicate `cardiff-giant.astro`. Key differences from free:

**Frontmatter:**
```astro
---
const stripeUrl = import.meta.env.PUBLIC_STRIPE_BUY_URL;
---
```

**Hero badge:** `$2.99` instead of `FREE`
```html
<span class="meta-badge price">$2.99</span>
```

**Hero button:** Buy button saves slug to localStorage before redirect, download button hidden until purchased
```html
<button onclick={`localStorage.setItem('historiqly_purchasing','{slug}');window.location.href='${stripeUrl}'`} class="btn-buy-primary" id="heroBuyBtn">
  <span class="btn-buy-text">Buy the Book</span>
  <span class="btn-buy-price">$2.99</span>
</button>
<a href="/books/{slug}.epub" class="btn-download-primary" id="heroDownloadBtn" style="display:none;" download>
  <span>Download Your Book</span>
</a>
```

**Conclusion CTA:** Same buy/download toggle pattern

**Purchase detection script:** (add after `</SidebarLayout>`, before `<style>`)

The homepage (`index.astro`) handles the main Stripe redirect. The case page just checks localStorage:
```html
<script>
  // Fallback: handle direct ?purchased=true on case page
  const params = new URLSearchParams(window.location.search);
  if (params.get('purchased') === 'true') {
    localStorage.setItem('historiqly_purchased_{slug}', 'true');
    localStorage.removeItem('historiqly_purchasing');
    history.replaceState({}, '', window.location.pathname);
  }

  const hasPurchased = localStorage.getItem('historiqly_purchased_{slug}') === 'true';

  if (hasPurchased) {
    const heroBuy = document.getElementById('heroBuyBtn');
    const heroDownload = document.getElementById('heroDownloadBtn');
    if (heroBuy) heroBuy.style.display = 'none';
    if (heroDownload) heroDownload.style.display = 'inline-flex';

    const ctaBuy = document.getElementById('ctaBuyBtn');
    const ctaDownload = document.getElementById('ctaDownloadBtn');
    const ctaTitle = document.getElementById('ctaTitle');
    if (ctaBuy) ctaBuy.style.display = 'none';
    if (ctaDownload) ctaDownload.style.display = 'inline-flex';
    if (ctaTitle) ctaTitle.textContent = 'Your Book Is Ready';
  }
</script>
```

### Web page sections (both free and paid)

| Section | Purpose |
|---------|---------|
| Hero | Full-screen background + badges + title + stats + buy/download button |
| Intro | Opening paragraph with drop cap — the hook |
| Bento Grid | 4 stat cards (scheme, weight, cost, profit, etc.) |
| Evidence | 3 forensic/evidence cards with images |
| Timeline | 4-5 key chronological events |
| Key Figures | 2 portrait cards (antagonist + protagonist/debunker) |
| Conclusion | Photo + text + CTA box with buy/download |

---

## Step 6 — Stripe Payment (Paid Books Only)

### How it works

All paid books cost **$2.99** and share a **single Stripe Payment Link**. No per-book setup needed.

1. Buy button saves the book slug to localStorage, then redirects to Stripe checkout
2. After payment, Stripe redirects to the homepage (`/?purchased=true`)
3. Homepage JS reads the slug from localStorage, marks the book as purchased
4. Redirects to the case page where the download button appears

### Environment variables (already set up)

`.env` (dev — Stripe test mode, redirects to localhost):
```
PUBLIC_STRIPE_BUY_URL=https://buy.stripe.com/test_9B6aEQ4ro3wS3Ox6N1djO01
```

`.env.production` (live — Stripe live mode, redirects to books.historiqly.com):
```
PUBLIC_STRIPE_BUY_URL=https://buy.stripe.com/8x23cxdvG0lK5Axc5Rbsc01
```

Use in any Astro page:
```astro
---
const stripeUrl = import.meta.env.PUBLIC_STRIPE_BUY_URL;
---
```

### No new Stripe setup needed for new books

Since all books use the same payment link, adding a new book does NOT require creating new Stripe products or payment links. Just use `PUBLIC_STRIPE_BUY_URL` and save the slug before redirect.

### Stripe API keys (for reference — only needed if creating new payment links)

Test: `***REDACTED_TEST_KEY***`
Live: `***REDACTED_LIVE_KEY***`

### Existing Stripe resources

| Resource | Test | Live |
|----------|------|------|
| Product | `prod_TzF3ZaqPcZcS3L` | `prod_TzF3Wrr6zbR3Rz` |
| Price | `price_1T1GZ32LUId0miwgFAoqmREs` | `price_1T1GZeRoR2EgeWtK0OOoog4i` |
| Payment Link | `test_9B6aEQ4ro3wS3Ox6N1djO01` | `8x23cxdvG0lK5Axc5Rbsc01` |

---

## Step 7 — Update the Volume Page

Edit `src/pages/vol/hoaxes.astro` (or the relevant volume page).

### Free book entry
```html
<div class="case-preview active">
  <span class="case-num">01</span>
  <a href="/cases/piltdown-man" class="case-title">The Piltdown Man</a>
  <div class="case-actions">
    <a href="/cases/piltdown-man" class="btn-pill accent">Read Case</a>
    <a href="/#book" class="btn-pill outline">Free EPUB</a>
  </div>
</div>
```

### Paid book entry
```html
<div class="case-preview active">
  <span class="case-num">02</span>
  <a href="/cases/{slug}" class="case-title">Book Title</a>
  <div class="case-actions">
    <a href="/cases/{slug}" class="btn-pill accent">Read Case</a>
    <a href={stripeUrl} class="btn-pill price-pill" id="{slug}BuyPill" onclick="localStorage.setItem('historiqly_purchasing','{slug}')">$2.99</a>
    <a href="/books/{slug}.epub" class="btn-pill outline" id="{slug}DownloadPill" style="display:none;" download>Download</a>
  </div>
</div>
```

Add purchase detection at the bottom (one block per paid book):
```html
<script>
  // Check each paid book
  ['cardiff-giant', '{new-slug}'].forEach(slug => {
    if (localStorage.getItem(`historiqly_purchased_${slug}`) === 'true') {
      const buyPill = document.getElementById(`${slug}BuyPill`);
      const downloadPill = document.getElementById(`${slug}DownloadPill`);
      if (buyPill) buyPill.style.display = 'none';
      if (downloadPill) downloadPill.style.display = 'inline-flex';
    }
  });
</script>
```

Don't forget the CSS for the price pill:
```css
.btn-pill.price-pill {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #000;
  font-weight: 800;
  border: none;
}
```

---

## Step 8 — Build and Test

```bash
# Build everything (EPUBs + Astro site)
npm run build

# Dev mode (web + hot reload, uses test Stripe URLs)
npm run dev

# Preview production build locally
npm run preview
```

### Testing the purchase flow (dev mode)

1. Run `npm run dev`
2. Go to `/cases/{slug}` — should show "Buy the Book $2.99" button
3. Click the button — goes to Stripe test checkout
4. Use test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. After "payment" — redirects to `localhost:4321/cases/{slug}?purchased=true`
6. Download button should appear
7. Refresh the page — download button persists (localStorage)
8. Go to `/vol/hoaxes` — should show "Download" instead of "$2.99"

### Testing the EPUB

- Open in Calibre, Apple Books, or any EPUB reader
- Verify cover shows as thumbnail in file manager
- Check all images load
- Check table of contents navigation works

---

## Purchase Flow Summary

```
User clicks "Buy the Book $2.99" on any case page
  → JS saves localStorage: historiqly_purchasing = "{slug}"
  → Redirects to Stripe checkout (single payment link for all books)
  → User pays $2.99
  → Stripe redirects to homepage: /?purchased=true
  → Homepage JS reads historiqly_purchasing from localStorage
  → Saves localStorage: historiqly_purchased_{slug} = true
  → Clears historiqly_purchasing
  → Redirects to /cases/{slug}
  → Case page sees historiqly_purchased_{slug} = true
  → Shows download button, hides buy button
  → On future visits: localStorage persists → download always visible
```

No backend needed. No webhooks. No auth. One Stripe Payment Link for all books.

---

## Checklist for a New Case

### Research & Content
- [ ] Research the topic thoroughly (history, people, timeline, evidence)
- [ ] Download 7-10 public domain images from Wikimedia Commons
- [ ] Write `src/data/books/{slug}.ts` with 8 chapters

### EPUB
- [ ] Create `scripts/build-epub-{slug}.mjs` (duplicate from cardiff)
- [ ] Update package.json build commands
- [ ] Run `npm run build:epub:{slug}` — verify EPUB and cover generated
- [ ] Test EPUB in a reader (cover, images, ToC, typography)

### Web Page
- [ ] Create `src/pages/cases/{slug}.astro` (duplicate from cardiff)
- [ ] All images referenced and displaying
- [ ] Buy button (paid) or download button (free) working

### Stripe (paid books only — no new Stripe setup needed)
- [ ] Use `PUBLIC_STRIPE_BUY_URL` in frontmatter (same for all books)
- [ ] Buy button saves slug: `localStorage.setItem('historiqly_purchasing', '{slug}')`
- [ ] Test full purchase flow with test card `4242 4242 4242 4242` in dev mode

### Volume Page
- [ ] Add entry to `src/pages/vol/hoaxes.astro` (or relevant volume)
- [ ] Price pill ($2.99) or Free EPUB button
- [ ] Purchase detection script for localStorage toggle

### Final
- [ ] `npm run build` — no errors
- [ ] `npm run preview` — all pages render
- [ ] Piltdown Man (free) flow still works
- [ ] All other existing books still work

---

## What polish-epub.mjs Does (Automatic)

You don't need to touch `polish-epub.mjs` — it's reusable. It automatically:

1. Replaces CSS with improved typography + dark mode
2. Adds `cover.xhtml` with the cover image
3. Renames random UUID image filenames to descriptive names (from alt text)
4. Removes duplicate `<h1>` headings that epub-gen-memory adds
5. Adds `epub:type` semantic attributes (`chapter`, `titlepage`, `epigraph`, `backmatter`)
6. Adds `epub:type` to figures and figcaptions
7. Removes inline styles (CSS handles everything)
8. Adds landmarks navigation (cover, ToC, start reading)
9. Fixes spine order (cover first, ToC non-linear)
10. Adds `properties="cover-image"` for thumbnail support
11. Adds EPUB 2 + 3 cover metadata and guide references
12. Adds subject tags and series metadata
13. Compresses images over 500KB (PNG → JPEG conversion, quality reduction)
14. Rebuilds ZIP with correct mimetype ordering (OCF 3.3)

---

## Cover Generator Reference

```javascript
await generateCover({
  backgroundImage: '/path/to/hero.jpg',   // High-res background
  title: 'Title\nLine Two',               // Use \n for line breaks
  subtitle: 'The Subtitle Goes Here',
  series: 'Vol. 1: Hoaxes',
  author: 'HistorIQly',
  outputPath: '/path/to/output.jpg',
});
```

Output: 1600x2400 JPEG with desaturated background, gradient overlay, gold series badge, white title, italic subtitle, "BASED ON REAL EVENTS" tagline, author name.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `epub-gen-memory` | Creates the raw EPUB from chapters |
| `sharp` | Image processing (cover generation + compression) |
| `adm-zip` | ZIP manipulation for EPUB post-processing |
| `astro` | Static site generator for the web pages |
| `tailwindcss` | Styling for the web pages |

---

## Common Issues

### Wikimedia images download as HTML
Cloudflare blocks direct downloads. Use the Wikimedia API to get the real URL, then download with a proper `User-Agent` header.

### Wikimedia 429 rate limiting
Use a compliant bot User-Agent: `HistorIQlyBot/1.0 (https://historiqly.com)`. Add delays between downloads.

### Stripe CLI says "API key expired"
The CLI config key expires periodically. Use `--api-key` flag with the key from `HistorIQly/.env.local` (test) or `HistorIQly/.env.production` (live) instead.

### EPUB images are huge
`polish-epub.mjs` handles this automatically — it compresses anything over 500KB. If the source images are very large (3+ MB from Wikimedia), expect 80-98% compression in the final EPUB.

### "purchased" state not persisting
localStorage is per-domain. If testing on `localhost:4321`, the Stripe redirect must also go to `localhost:4321`. The test payment link is configured for this. The live payment link redirects to `books.historiqly.com`.
