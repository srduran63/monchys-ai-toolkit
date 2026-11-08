# Monchys AI — Subscription AI Toolkit

Full-stack SaaS that sells AI-powered productivity tools on a subscription model: customer accounts, monthly plans, one screen per tool, Stripe billing, an admin panel, and per-customer AI cost control.

🇪🇸 [Leer en español](README.es.md)

## Highlights

- **9 tools in one product**: file converter, transcription, PDF summarizer & Q&A, CV builder, background remover, booking assistant with AI chat, budgeting assistant, and a wellbeing journal.
- **Local ML models**: Whisper (speech-to-text) and BiRefNet Lite (background removal) run on the server via ONNX, downloaded from Hugging Face on first use, with a background job queue.
- **Claude integration** with structured tool use for the booking chat, PDF Q&A, and CV writing improvements.
- **AI cost control**: every Claude call logs tokens and estimated cost per feature, customer, and business. Monthly budgets automatically fall back to non-AI versions when the cap is reached.
- **Stripe subscriptions** with webhooks for renewals, failed payments, and cancellations, plus a demo mode that works without a payment gateway.
- **Secure admin**: httpOnly sessions, hashed password, lockout after 5 failed attempts.
- **Programmatic explainer videos**: a 16-second video per tool is rendered frame by frame from an HTML scene with a headless browser and encoded with ffmpeg.
- **SEO**: canonical URLs, sitemap, Open Graph, and `VideoObject` structured data.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Node.js, Express 5 (ESM) |
| AI | Anthropic Claude API, Hugging Face Transformers (ONNX Whisper), BiRefNet, Replicate |
| Media | ffmpeg, sharp, pdf-lib, heic-convert |
| Payments | Stripe (Checkout + webhooks) |
| Auth / DB | Supabase (Postgres, Sign in with Apple), JSON storage for local mode |
| Deploy | Docker, Fly.io, Netlify |

## Getting Started

```bash
npm install
npm run set-password   # creates the admin user and password in .env
npm run dev            # http://localhost:5173
```

Production: `npm run build` then `npm start` (serves on `PORT`, default 3001). Set `COOKIE_SECURE=true` behind HTTPS.

## Environment Variables

| Variable | Purpose |
|---|---|
| `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | Admin access and session signing |
| `ANTHROPIC_API_KEY` | Enables AI features. Without it, everything works except AI-only features. |
| `AI_BUDGET_CUSTOMER_USD` / `AI_BUDGET_BUSINESS_USD` / `AI_BUDGET_GUIDE_USD` | Monthly AI spend caps |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY` | Billing (optional; demo mode without them) |
| `WHISPER_MODEL` | Transcription model (default `onnx-community/whisper-base`) |
| `SITE_URL` | Public domain used for canonical URLs and sitemap |

## Tools

| Tool | How it works | AI |
|---|---|---|
| Converter | Images (incl. HEIC), image → PDF, audio/video → MP3 via sharp + ffmpeg | No |
| Converter Pro | Video (MP4, WEBM, GIF, WhatsApp compression), 2 GB files, batches of 50 with ZIP | No |
| Booking assistant | Public booking page per business with form, schedule, and AI chat | Chat only |
| Transcription | Server-side Whisper, background queue, TXT/SRT/Word export | Summary only |
| PDF summarizer | AI summary and Q&A (including scanned PDFs); keyword-based fallback | Yes |
| CV builder | A4 live preview, 3 layouts × 5 colors, PDF and Word export | Writing tips |
| Background remover | BiRefNet Lite on the server, transparent/white/color background, ZIP | No |
| Budgeting | Understands phrases like "spent 20 on food", budgets, goals, alerts | No |
| Journal | Mood tracking, 30-day chart, breathing exercise, crisis helplines | No |

## Measured AI Costs

Booking chat ≈ $0.06 · 20-page PDF ≈ $0.26 (+$0.02 per question) · cover letter ≈ $0.02 · CV improvement ≈ $0.002

## Roadmap

- Password recovery by email
- WhatsApp booking assistant and automatic reminders
