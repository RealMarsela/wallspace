# Wallspace design contract (reference: wavelength.cx, chosen 30 Oct)

Rule: the same system, quality and motion as Wavelength, in Wallspace's own motif, colours and type. Never copy their
assets, artwork, copy or logo. Applies to the landing page AND every product page, auth and onboarding.

## Motif: their transit lines -> our city streets
- Wavelength: thick multi-colour "rail" ribbons that run off-canvas, bend at 90/45 degrees with large radii, carry dotted
  or dashed centre lines, and meet square "stations" holding integration logos.
- Wallspace: STREET RIBBONS. Same ribbon geometry, read as streets on a city plan: a solid ribbon with a dashed lane line,
  parallel ribbons for avenues, 45-degree bends for diagonals (Atlanta's Ponce, Moreland). Stops are BILLBOARD FACES:
  rounded rectangles in a 3:1 or 2:1 frame (not squares), on a small post tick, holding a copy line, a face ID or a
  connector logo. Where streets cross, a crosswalk block (striped square) replaces their "X" junction.
- Ribbons enter from page edges and frame sections (hero left/right, dark bands, CTA, testimonial cards), never sit
  behind body text.

## Tokens (single source: src/styles/tokens.css)
- Base: ink #22211D (dark bands, primary button), paper #FBFAF7 (page), panel #EFEEEA (cards on paper), ink-2 #2F2E29
  (cards on dark), line #E2E0DA, muted text #6E6B63, muted on dark #A9A69C.
- Street inks (accents, each also a light tint for tags): signal yellow #FFD12E, poster red #FF5B3A, cobalt #4C6BFF,
  park green #3FD6A0, lilac #C49BFF. One accent per feature card; ribbons mix 2-4.
- Radius: 8 (cards, inputs, buttons), 14 (feature panels), 999 (pills/tags), 4 (chips). Border 1px line.
- Type: Host Grotesk (free, Google Fonts) at weight 400 for everything, emphasis by weight 600 on single words (their
  "purpose ... post sales" trick). Display 64/1.05/-0.02em, H2 40/1.1/-0.02em, H3 32/1.1, body 16/1.4, small 14/1.4,
  micro 12/1.35. Numerals and step markers in Geist Mono 500 ("01 02 03" in a 40px circle on ink-2).
- Backgrounds: a faint vertical pinstripe gutter left/right of the content column on paper sections; a dot grid on dark
  bands. Content column 1192px max, 160px side gutters on desktop, 16px on phone.

## Components (build each once; product pages reuse them)
- Top bar: thin ink announcement strip + paper nav (logo left, 3 links centre, ink pill button right with arrow).
- Buttons: ink pill with arrow (primary), white on dark (primary on ink), ghost ink-2 (secondary). Arrow nudges 2px on hover.
- Hero: big centred headline on ink, one line of body, one button, then a framed PRODUCT WINDOW (real Wallspace UI:
  the picks table with faces, neighbourhood, cost, taste tags as tinted pills, copy line) overlapping into the next
  section; street ribbons enter from both edges.
- Logo strip: "Built on" row (Qloo, NVIDIA, Nebius, Cloudflare, Tavily) greyscale on panel with dot gutters.
- Feature split cards: panel card, one side a coloured media panel (accent fill + animated product clip/still), other
  side icon chip (accent tile with ink glyph) + label, H3, muted body, text link with arrow. Alternate sides.
- Product overview bento: 2x2 panels, each with icon chip, title, one line, a real UI fragment cropped at the bottom,
  ribbons running behind the fragment.
- Dark band: ink rounded block, dot grid, centred H2 + button, 3 numbered cards on ink-2 with dashed dividers, ribbons
  exiting both sides.
- Testimonial/proof cards -> "From the sample plan" cards: ink cards with a ribbon diagonal, a real copy line and the
  face it ran on (no fake testimonials, no fake logos).
- Connectors band: ink panel, Slack/Gmail/Outlook/HubSpot/Sheets/Calendar logos as billboard-face stops on the street
  network; "Connect your tools" button.
- FAQ: H2 left, accordion right (panel rows, plus icon rotates to x).
- CTA + footer: ink, H2 left, two buttons, ribbons sweeping in from the right and running along the footer edge.
- App shell (product): paper canvas, left rail nav on panel, top bar with workspace switcher; tables, tags, chips and
  inputs exactly as in the hero window. Map pages put the MapLibre map inside a framed window with a street-ribbon edge.

## Motion
- Ribbons draw in on scroll (SVG path length, 900 ms, ease-out), lane dashes then crawl slowly (dash offset loop, 6 s)
  like traffic; stops pop with a 120 ms scale 0.96 -> 1.
- Hero window rises 24 px and fades in after the headline; table rows stagger 30 ms.
- Feature media panels animate live product UI built in HTML/SVG (no screen recordings; no video work in this repo).
- Respect prefers-reduced-motion: ribbons render drawn, no crawl, no stagger.
