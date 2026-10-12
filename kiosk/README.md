# MIOW Hardlock Kiosk Companion

This folder contains the **dedicated Kiosk / WebView wrappers** for MIOW LMS, addressing the professor's suggestion:
> *"mag program na lang ug app... then gamitan webview then e-load imo website... ma control nato nga persistent"*

---

## 1. Option A: Zero-install Shell Kiosk (Chromium/Chrome)
Instantly tests native kiosk lock without installing any dependencies or packages:

```bash
# Launch locally:
./launch-kiosk.sh http://127.0.0.1:3000/dashboard/student/quizzes

# Or test with your Vercel preview URL:
./launch-kiosk.sh https://your-preview-branch.vercel.app/dashboard/student/quizzes
```

**Features:**
- Runs in true `--kiosk` borderless fullscreen.
- Blocks browser toolbar, address bar, navigation buttons, and menus.
- Disables overscroll back navigation and gestures.
- Clean isolated profile in temporary storage (`/tmp/miow_kiosk_profile`).

---

## 2. Option B: Native WebView / Electron Companion (`main.js`)
For classroom computer labs or student laptops requiring teacher exit locks:

### Run:
```bash
cd kiosk
bun install electron  # or npm install electron
MIOW_URL="https://your-preview-deployment.vercel.app" bun run start
```

**Features:**
- `kiosk: true` + `alwaysOnTop: true`: Traps window focus and prevents switching out.
- DevTools and context menu disabled.
- Popups and external URL escapes intercepted and denied.
- Teacher Emergency Exit: `Ctrl + Shift + Q` (prompts teacher to exit).
