---
name: sosobook-visual-style
description: Define and implement SosoBook's hand-drawn journal, sticker collage, school sports day, and playful wellness visual language across the Vue PWA.
metadata:
  short-description: SosoBook visual design system
---

# SosoBook Visual Style

## Design read

Reading this as: a daily-use wellness and friendly competition PWA for people who want a motivating journal, with a handmade picture-book and school sports day language, leaning toward tactile paper collage rather than dark esports or generic wellness minimalism.

## Dials

- `DESIGN_VARIANCE: 8`
- `MOTION_INTENSITY: 5`
- `VISUAL_DENSITY: 4`

Use asymmetry and small irregularities to create a handmade feeling, but keep calendar, weight, and ranking information easy to scan.

## Visual north star

The product should feel like opening a cheerful notebook where someone has added stickers, crayon marks, sports-day cards, and small paper labels. The provided avatar and sticker assets are the source of truth for texture, color, outline weight, and illustration personality.

The provided school and cherry-blossom reference image reinforces these traits:

- warm paper background
- visible brush and crayon texture
- vivid cobalt blue, sky blue, pink, sunflower yellow, grass green, and orange
- imperfect hand-drawn edges
- small decorative marks used as a scene, not as random UI noise
- human, local, optimistic storytelling

## Palette

Use semantic tokens rather than scattered hex values. The paper palette is an explicit product requirement, not a generic premium-consumer default.

- `paper`: warm off-white with a very subtle grain
- `ink`: softened dark blue-black, never pure black
- `cobalt`: primary action and competition emphasis
- `sky`: calm information surfaces
- `petal`: sticker and diary highlight
- `sun`: success, champion, and energy accents
- `leaf`: positive status and check-in completion
- `orange`: warning, active sports-day energy, and secondary emphasis

Keep one dominant accent per screen. Use other palette colors only when they carry meaning or belong to an illustration/sticker. Do not add purple gradients, neon glows, or unrelated accent colors.

## Material language

- Prefer paper backgrounds, cut-paper panels, sticker edges, taped notes, underlines, and soft ink outlines.
- Use one consistent corner system: paper panels 16px, controls 12px, sticker shapes organic or image-defined.
- Shadows are short, soft, and tinted toward the paper or ink. Avoid black floating-card shadows.
- Use texture on fixed or small decorative pseudo-elements, never on large scrolling containers.
- Use real assets from `avatar/`, `nav/`, `sticker/`, and the supplied reference image. Do not replace illustrations with generic emoji or hand-rolled placeholder SVGs.
- Decorative marks should frame content or show state. Remove them if they compete with weight, date, rank, or action labels.

## Paper grid background

The global page background may use a light notebook grid. It should feel like printed stationery, not graph paper or a technical dashboard.

- Base: warm off-white paper.
- Grid: thin, low-contrast blue-gray lines, approximately 24px to 28px apart.
- Optional major grid: a much lighter line every 4 or 5 cells.
- Keep the grid below content with a fixed, non-interactive background layer.
- Use lower contrast behind forms, weight numbers, rankings, and certificate text.
- Do not apply the grid to every nested card. Let paper panels interrupt it so the page still has hierarchy.
- Avoid animated grids, perspective grids, neon lines, and dense graph-paper patterns.

Reference CSS direction:

```css
.sosobook-paper {
  background-color: var(--sosobook-paper, #fffaf0);
  background-image:
    linear-gradient(rgb(80 135 170 / 0.10) 1px, transparent 1px),
    linear-gradient(90deg, rgb(80 135 170 / 0.10) 1px, transparent 1px);
  background-size: 26px 26px;
}
```

The exact colors and opacity remain tokens so the grid can be softened for accessibility or high-density screens.

## Layout

- Mobile-first, with a centered and comfortable desktop reading column.
- Calendar and check-in screens prioritize one clear action at a time.
- Use offset paper blocks and occasional asymmetric composition, but keep the primary action in a predictable place.
- The bottom navigation is a physical notebook tab or sticker strip, not a glassmorphism dock.
- Use empty space as paper margin. Do not fill every gap with doodles or cards.

## Motion

Motion communicates feedback, not decoration:

- sticker selection: a small lift and settle
- saved check-in: a stamp or paper press response
- calendar month change: a short page-turn or horizontal slide
- certificate creation: a brief celebratory reveal

Use transform and opacity only. Respect `prefers-reduced-motion`; reduced motion keeps the state change but removes bounce, parallax, and repeated loops. Do not attach raw scroll listeners.

## Accessibility and consistency

- Body text and form labels must meet WCAG AA contrast.
- Do not use crayon lettering for small labels, numeric weight values, error messages, or long paragraphs.
- Every sticker and avatar needs meaningful alt text or an empty alt when decorative.
- Every interactive sticker has a text label or accessible name.
- Keep the page in one light paper theme for MVP. If dark mode is added later, preserve the paper-and-ink hierarchy instead of switching to esports black.
- Loading, empty, offline-pending, error, and success states must use the same paper and sticker language.

## Anti-patterns

- dark gaming UI
- generic wellness gradients
- full-screen glassmorphism
- three identical feature cards
- oversized dashboard metrics
- random emoji replacing provided assets
- handwriting applied to every string
- decorative doodles behind low-contrast text
- fake charts or fake screenshots made from empty rectangles

Before shipping a visual surface, inspect it at a narrow mobile width and confirm that the paper, sticker, type, color, and motion choices still feel like one SosoBook world.
