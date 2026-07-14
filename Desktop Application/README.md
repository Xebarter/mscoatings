# MS Coatings Admin — Desktop Application

Professional Electron desktop client for the MS Coatings ERP admin dashboard.

## Features

- **Overview Dashboard** — KPIs, recent sales, low-stock alerts, quick links
- **Point of Sale** — Product search, USB barcode scanner support, checkout
- **Products** — Full catalog with stock status
- **Inventory** — Stock levels, adjustments, movement history
- **Orders** — Online order management with status updates
- **Field Sales** — Agents and picks overview
- **Reports** — Revenue charts and analytics from the backend API

## Setup

1. Install dependencies:

```bash
cd "Desktop Application"
npm install
```

2. Copy `.env.example` to `.env` and fill in your Firebase credentials (same as the main Next.js project, with `VITE_` prefix):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_ADMIN_EMAILS=admin@example.com
VITE_APP_URL=https://www.mscoatings.shop
```

## Development

```bash
npm run dev
```

Launches the Electron app with hot reload.

## Build

```bash
npm run build
```

## Package for distribution

```bash
npm run package
```

Creates a Windows installer in the `release/` folder.

## Tech Stack

- Electron + Vite + React 19 + TypeScript
- Tailwind CSS 4
- Firebase Auth & Firestore
- Framer Motion animations
- Recharts for analytics

## Offline mode

After the first online sign-in and sync, the app works without internet:

| Feature | Offline behavior |
|---------|------------------|
| Session | Restored from local Firebase Auth persistence |
| Products / POS | Cached catalog; barcode scan & checkout work |
| Sales & stock | Written locally and auto-synced when back online |
| Inventory | Adjustments queue and sync |
| Orders / Field sales | Read from last synced cache |
| Reports | Built from cached local sales (full API reports when online) |

Use the **refresh** icon next to Online in the sidebar to force a cache warm-up while connected.

**Limits:** First-time login requires internet. New products created only on another device appear after the next online sync.

## Notes

- Uses the same Firebase project and admin emails as the web admin console
- Reports page uses `VITE_APP_URL` when online; falls back to local sales offline
- USB barcode scanners work automatically via keyboard input emulation
