---
name: sosobook-journal-ui
description: Build SosoBook's journal-like interface components such as paper pages, sticker selectors, calendar cells, check-in cards, competition cards, and certificate layouts.
metadata:
  short-description: SosoBook journal UI patterns
---

# SosoBook Journal UI

Use this skill when creating or revising reusable UI components for the SosoBook PWA.

## Component recipes

### Notebook background

Use the light paper grid on the page shell, especially for the calendar and onboarding surfaces. The grid is a background texture, not a content container. Lower its contrast behind forms and rankings, and let paper panels cover parts of it to create the feeling of layered stationery.

### Paper page

Use a warm paper surface, generous notebook margins, a restrained grain layer, and one clear page title. Avoid making every block a floating card.

### Sticker selector

Show actual sticker artwork in a breathable grid. Selected state uses a paper pin, ink outline, or small lift. Do not place text over the artwork. Each sticker must remain identifiable without color alone.

### Calendar cell

Keep the date number readable first. Place the sticker as a small physical object inside the cell. The selected day uses an ink outline or paper tab. Do not shrink stickers until they become visual noise.

### Check-in card

The weight input is the main action. Put the unit next to the input, keep the label above it, and make the save state feel like stamping the page. Validation stays plain and readable rather than handwritten.

### Competition card

Show competition name, dates, countdown, current rank, and percentage in an information hierarchy. Use paper edges or a sports-day bib motif for energy. Avoid dense dashboard tiles and filled progress bars.

### Certificate

Treat the result as a saved page in the notebook: title, champion or rank, participant summary, and chart. Keep the certificate readable when printed or shared. Use real curves and values, not decorative fake precision.

## State coverage

Every component must define loading, empty, error, offline-pending, and success states. Keep state messages short and functional. Use a paper note, sticker, or stamp only when it supports the meaning.

## Responsive rules

- Below 768px, collapse multi-column compositions to one column.
- Keep primary actions within thumb reach.
- Allow sticker grids to use horizontal scroll only when the labels remain discoverable.
- Preserve the bottom navigation safe-area padding.
- Never allow a long competition name or button label to create an accidental two-line action control.

## Motion rules

Use short feedback transitions for selection and save. Do not add perpetual floating, shimmer, marquee, or parallax effects to routine data screens. Any stronger transition must explain whether it represents hierarchy, feedback, or a state change, and must degrade under reduced motion.

## Content and accessibility

- Label inputs above the field, never use placeholder text as the label.
- Use text plus icon or text plus color for ranking and status.
- Keep weight numbers in a highly legible font, not the crayon display style.
- Use meaningful alt text for avatars and stickers.
- Make tap targets at least 44px where practical.
