# KnewSearch Marketing Website

Public-facing marketing site for [knewsearch.com](https://knewsearch.com).

## Getting Started

```bash
cd marketing
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## Structure

```
marketing/
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout with SEO metadata
│   │   ├── page.tsx         # Homepage (composes all sections)
│   │   └── globals.css      # Global styles and utility classes
│   └── components/
│       ├── navbar.tsx        # Sticky nav with scroll-based active state
│       ├── hero.tsx          # Above-the-fold hero with product preview
│       ├── metrics-preview.tsx
│       ├── problem-section.tsx
│       ├── process-section.tsx
│       ├── features-section.tsx
│       ├── product-preview.tsx
│       ├── proof-section.tsx
│       ├── how-it-works-section.tsx
│       ├── pricing-section.tsx
│       ├── cta-section.tsx
│       ├── loading-skeleton.tsx
│       ├── section-header.tsx
│       └── footer.tsx
├── tailwind.config.ts       # Custom theme (colors, typography, shadows)
└── package.json
```

## Customizing Copy

All marketing copy is inline in each section component. To update:

- **Headlines and descriptions**: Edit the relevant component in `src/components/`
- **Navigation links**: Edit `src/components/navbar.tsx`
- **Footer links**: Edit `src/components/footer.tsx`
- **SEO metadata**: Edit `src/app/layout.tsx`
- **Colors and typography**: Edit `tailwind.config.ts`

## Design System

### Philosophy

The visual system prioritizes calm confidence over visual excitement. Every choice is designed to feel trustworthy to enterprise buyers: restrained color, generous whitespace, and hierarchy driven by type weight and spacing rather than decoration.

### Color

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-700` | `#4338ca` | Anchor brand color. CTAs, active states, brand marks. |
| `primary-50`–`100` | `#eef2ff`–`#e0e7ff` | Tinted backgrounds for icon containers and hover states. |
| `primary-950` | `#1e1b4b` | Dark section backgrounds (Proof section). |
| `positive-500`–`600` | `#14b8a6`–`#0d9488` | Positive deltas, "stable", success indicators only. Never CTAs. |
| `charcoal` | `#1a1a2e` | Primary text. Darker than default gray for better contrast. |
| `charcoal-light` | `#374151` | Secondary text (subheadings). |
| `charcoal-muted` | `#6b7280` | Body text, descriptions. |
| `charcoal-faint` | `#9ca3af` | Labels, captions, tertiary info. |
| `surface-50` | `#f9fafb` | Page background. Off-white, not stark. |
| `surface-100`–`200` | `#f3f4f6`–`#e5e7eb` | Card backgrounds, dividers, hover tints. |

Two accent colors maximum. Primary blue handles 95% of color use; positive teal is reserved strictly for numeric deltas and success indicators.

### Typography

Font: **Inter** (Google Fonts, weights 300–800).

The scale uses baked-in `fontWeight` values in Tailwind so each size has an opinionated default weight:

- `display-lg` (4.5rem/700) — Hero headline only
- `display` (3.75rem/700) — KPI large numbers
- `display-sm` (3rem/700) — Section headlines on desktop
- `heading-lg` (2.25rem/700) — Section headlines on mobile
- `body-lg` (1.125rem) — Subheadlines, lead paragraphs
- `body` (1rem) — Default body text
- `body-sm` (0.875rem) — Card descriptions, secondary text
- `caption` (0.8125rem) — Labels, kickers, metadata

### Elevation

Shadows replace visible borders throughout:

- `subtle` — Near-invisible lift for inner elements
- `soft` — Default card resting state
- `card` — Prominent card (KPIs, hover states)
- `card-hover` — Interactive lift on hover
- `elevated` — Hero product preview, floating elements

### Spacing

- `section-padding`: `py-20 sm:py-28 lg:py-32` — Generous vertical rhythm
- `section-container`: `max-w-7xl` with responsive horizontal padding
- Cards use consistent `rounded-2xl` corners and `p-6`–`p-7` padding

### Navigation

The navbar uses scroll-based section tracking. The active link gets full `text-charcoal` weight with a 1px primary underline. On scroll, the navbar transitions from transparent to frosted glass (`backdrop-blur-xl`) with a subtle shadow.

### Charts

SVG area charts with gradient fills. Gridlines are dashed, low-contrast (`#e5e7eb`, 0.5px). Axes labels are secondary (`charcoal-faint`, 7px). The trend line endpoint has a subtle pulsing dot to draw the eye to the current value.
