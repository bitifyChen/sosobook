---
name: sosobook-crayon-type
description: Apply SosoBook's playful handwritten and crayon-like typography without sacrificing readability, accessibility, or numeric clarity.
metadata:
  short-description: SosoBook crayon typography
---

# SosoBook Crayon Typography

## Role of the style

Crayon or handwriting treatment is an accent voice for page titles, encouragement, stamps, and small emotional moments. It is not the default font for body text, forms, dates, weights, rankings, or error messages.

## Hierarchy

- Display titles: rounded, friendly sans or licensed handwritten display face
- Emotional accent: crayon or hand-lettered treatment for one short phrase
- Body and labels: highly legible sans-serif
- Numbers: tabular or highly legible sans-serif with clear decimal shapes
- Data emphasis: weight and rank use weight, color, and spacing instead of decorative handwriting

## Implementation guidance

- Check existing project dependencies and local font assets before importing a font.
- Prefer a local or licensed font with a strong fallback stack.
- If no font asset is available, use restrained CSS texture, text-shadow, underline, or an irregular border rather than a fake full-page handwriting filter.
- Keep letter spacing relaxed; do not apply tight display tracking to crayon lettering.
- Give italic or angled display words enough line-height and descender clearance.

## Usage limits

- One crayon emphasis per small composition is usually enough.
- Do not use the treatment for more than a short phrase.
- Never use it for warnings, validation, legal copy, body paragraphs, or critical numeric values.
- Do not mix multiple handwriting styles on the same screen.

## Color and contrast

Use the established SosoBook ink or cobalt token. Avoid pale crayon colors for text. If a crayon treatment reduces contrast, add a solid paper backing, a clear ink outline, or switch to the regular text style.

## Motion

If animated, reveal the text like a short marker stroke or apply a single stamp response. Never use a continuous typewriter loop. Respect reduced motion.

## Review checklist

- Can the user read the text at a glance on a small screen?
- Does the phrase still work if the decorative treatment is removed?
- Is the type treatment used as an accent rather than a UI dependency?
- Does it match the brush texture of the supplied avatar, sticker, and school-life reference artwork?
