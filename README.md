# Andi Sharil Azwan — Portfolio

A single-page portfolio site for an **AI Automation Engineer**. Dark, terminal-flavored
design with an animated workflow diagram, count-up stats, scroll-reveal sections, and
case-study project cards.

This folder is **ready to deploy as-is** — `index.html` is fully self-contained
(all CSS, JS, fonts, and the animation runtime are inlined). No build step, no
dependencies, no framework. Just static hosting.

---

## Deploy to Vercel

Pick whichever is easiest for you.

### Option A — Drag & drop (fastest, no tools)
1. Go to https://vercel.com/new
2. Drag this whole folder onto the page.
3. Click **Deploy**. Done — Vercel serves `index.html` automatically.

### Option B — Vercel CLI
```bash
npm i -g vercel        # one time
cd claude-code-handoff
vercel                 # follow prompts → preview URL
vercel --prod          # promote to your production domain
```

### Option C — Git + Vercel (best for ongoing edits)
```bash
cd claude-code-handoff
git init && git add . && git commit -m "Portfolio site"
# push to a GitHub repo, then "Import Project" at vercel.com/new
```
Every push to `main` auto-deploys.

> No `vercel.json` is needed — a static `index.html` at the root just works.

---

## Editing with Claude Code

Open this folder in your terminal and run `claude`. A few things worth telling it:

- **`index.html` is a compiled bundle — don't hand-edit it.** It's 255 KB of inlined
  fonts + runtime and is painful to edit directly. Treat it as the build output.
- For real ongoing development, ask Claude Code to **rebuild this as a clean project**
  in whatever stack you prefer. Two good paths:
  - **Plain static** — split into `index.html` + `style.css` + `script.js`. Deploys to
    Vercel identically, stays dependency-free.
  - **Next.js / Astro / Vite** — if you want components, routing, or a CMS later.
    `npx create-next-app` or `npm create astro@latest`, then recreate the sections.

Suggested first prompt for Claude Code:
> "This `index.html` is a self-contained portfolio. Recreate it as a clean
> [Next.js / Astro / plain HTML+CSS+JS] project with the same visual design,
> splitting the inline styles and the reveal/counter/typing JS into proper files.
> Keep it deployable to Vercel with no extra config."

---

## What's in the design (for reference)

**Aesthetic:** dark technical / terminal. Background `#0a0a0f`, violet accent `#a78bfa`
with indigo `#818cf8`. Display font **Space Grotesk**, mono accents **JetBrains Mono**.

**Sections (top to bottom):**
1. **Nav** — fixed, blurred; monogram + name, anchor links, "Get in touch" CTA.
2. **Hero** — status pill, name, a typing terminal line, the tagline quote, summary,
   CTAs, and an animated SVG workflow diagram (Webhook → Claude → n8n → Monday / Telegram
   with flowing data packets).
3. **Stats** — six count-up metrics (35+ workflows, 11 cities, 14+ venues, 100+ boards,
   2× capacity, ~94% intake saved).
4. **Work** — five project case studies in *problem → built → outcome* format. The
   **Catering Operations Automation System** is the full-width flagship (12 workflows,
   4-layer architecture, chronological FIFO, DeepSeek V4 Flash agentic bot, test stats).
5. **Stack** — grouped skill chips + language proficiency bars.
6. **Experience** — vertical timeline (Zest Venture, CUD Samsudin, Diploma).
7. **About** — narrative + animated monogram panel.
8. **Contact** — email / phone / location with mailto + tel CTAs.
9. **Footer**.

**Motion:** reveal-on-scroll (with a safety-net fallback so content always appears),
animated counters, a looping typed headline, CSS-animated workflow packets, and hover
lifts on cards.

**Content** is pulled from the résumé and the updated Catering project brief — all copy
is final and accurate.

---

## Files
- `index.html` — the deployable, self-contained site.
- `README.md` — this file.
