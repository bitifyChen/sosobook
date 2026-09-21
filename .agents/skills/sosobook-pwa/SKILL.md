---
name: sosobook-pwa
description: Build or modify the SosoBook Vue 3 PWA, including mobile-first screens, routing, offline behavior, and GitHub Pages deployment.
metadata:
  short-description: SosoBook PWA implementation
---

# SosoBook PWA

Read `MVP_SPEC.md` and `sosobook-visual-style` before changing user-facing screens.

- Use Vue 3, Vite, JavaScript, Pinia, Vue Router, Tailwind CSS, and `vite-plugin-pwa`.
- Preserve the four primary destinations: calendar, today check-in, competitions, and fitness card.
- Default authenticated landing page is the calendar.
- Build mobile-first and keep a comfortable centered desktop view.
- Respect safe-area insets and touch-friendly controls.
- Use History routing with a GitHub Pages `404.html` fallback.
- Cache the App Shell and static assets; Firestore remains the synced data source.
- Support offline check-in and clear pending, sync-failed, and success states.
- Do not add browser push notifications in the MVP.

Before delivery, test direct refresh of every route, narrow mobile widths, desktop widths, offline check-in, reconnect synchronization, and first-install behavior.
