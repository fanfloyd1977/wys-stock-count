# WYS (Stock Counting App) — Claude Instructions

> All workspace rules (security, images, design, GitHub, environment) are defined in `../CLAUDE.md`. This file contains only project-specific notes.

## Project Overview
Stock counting app for a Thai lighting/smart-home integrator client, built together with a collaborator who works with the client directly. The client buys lighting/smart-home devices from vendors, resells and installs them for their own clients, and currently counts stock manually. Goal: replace that with an app, then sell it to the client once validated.

## Architecture (demo phase)
- **App:** single-file HTML/JS, hosted on GitHub Pages — iPhone camera scans vendor QR/barcodes (no physical scan gun available yet; a Zebra-style scan gun was suggested by the collaborator but is unconfirmed as an actual client requirement).
- **Backend/storage:** Google Sheets + Google Apps Script "web app," not Supabase — simpler for a demo, and the client already thinks in spreadsheet terms. Apps Script holds the Google credentials so nothing sensitive ships in the public GitHub Pages code.
- **Duplicate handling:** Apps Script checks if a scanned code already has a row — increments qty if yes, adds a new row if no. Needs `LockService` to avoid a race condition if two people scan the same code at the same instant.
- **Google account for this project:** `wys.trt@gmail.com` — dedicated account, separate from personal, to keep client data boundaries clean. Use an Incognito window (or a dedicated Chrome profile) when working in it to avoid Google Drive "unable to open the file" errors caused by multiple accounts mixing in one browser session.

## Open questions (unresolved)
- Does counting happen in a fixed warehouse or across install sites/technician vehicles?
- What system (if any) currently holds the client's stock numbers — spreadsheet vs real inventory software?
- Is a physical Zebra-style scan gun an actual client requirement, or just the collaborator's guess?
- **Unique key for counting:** vendor QR/barcode is likely just a SKU/product code (same on every unit of that product) — with SKU alone, the app can't tell "5 real units" from "same unit scanned 5 times by accident." Ask collaborator: when the client receives stock from a vendor/supplier, do they put their own unique identifier on each box/unit themselves (e.g. a running-number sticker)? If yes, that becomes the true per-unit dedup key instead of relying on SKU + physical "move as you scan" process.

## Progress log
- 2026-08-24: Created test Google Sheet ("Stock Count Test") under `wys.trt@gmail.com`; confirmed a basic Apps Script `appendRow` write works.
- 2026-08-24: Built V1 —
  - `index.html` — the app itself. PIN lock (SHA-256 via Web Crypto, same pattern as WordWise), Scan screen (camera via `html5-qrcode` CDN lib, supports QR + EAN/UPC/Code128/Code39 barcodes), Summary screen (live table from the Sheet), Settings screen (paste the Apps Script Web App URL here once deployed; stored in `localStorage`). Theme: premium charcoal + brass/gold palette (Playfair Display + Inter fonts) — inferred from palicon.co.th's "Mastering Light" brand feel since exact hex values weren't extractable from the live site; worth a visual gut-check once you see it live.
  - Duplicate handling: every scan increments qty for that code. If the code already existed before this scan, the app shows a distinct amber "already counted" banner + a low double-buzz alarm sound (vs. a green banner + rising chime for a genuinely new code) — the human-in-the-loop check discussed for the SKU-only limitation.
  - `AppsScript.gs` — the backend code for you to paste into your Sheet's Apps Script editor and deploy yourself (you own that account/step). Handles the exists→increment / new→add-row logic with `LockService` to prevent race conditions. Full deploy steps are in the file's header comment. Reuses the same column layout (CODE | QTY | LAST SCANNED) as the "Stock Count Test" sheet already built.
  - `sample-codes.html` — a local page that renders scannable QR codes for 10 fictional demo SKUs, since no real vendor codes were available yet. Brand names are the real Palicon-listed lighting brands (palicon.co.th/our-business/premium-selection); model numbers/codes are made up for testing only.
  - Verified locally with Playwright (fake camera device) — PIN creation/unlock, tab navigation, URL validation, and camera initialization (via `html5-qrcode`) all work with no console errors. Could not test the actual scan→Sheet round trip since the Apps Script hasn't been deployed yet (that's the collaborator's/user's next step).
- **Not yet done:** deploying `index.html` to GitHub Pages (needs a repo + push — hasn't been confirmed with the user yet), user deploying `AppsScript.gs` and pasting the resulting URL into Settings, end-to-end test with real camera on iPhone.
