# Originals — do not deploy

Full-resolution sources for assets that ship resized in `Assets/`.
Kept so the optimised versions can be regenerated at a different size
without re-exporting from the design file.

Regenerate with, e.g.:

    sips --resampleWidth 248 _masters/bhawna-portrait.png --out bhawna-portrait.png

| Shipped | Size | From master | Displayed at |
|---|---|---|---|
| `bhawna-portrait.png`      | 146 KB | 1086x1448 | 124px circle |
| `UPI-hero.jpg`             | 192 KB | 2880x1250 PNG | 757px |
| `UPI-instrument-table.png` | 270 KB | 2512x878  | 780px |
| `UPI-instrument-cards.png` | 146 KB | 2692x636  | 780px |

`UPI-hero` became a JPEG: its only transparency was rounded corners, and the
container already clips with `border-radius: 20px; overflow: hidden`.

Exclude this folder from any deploy (it is 7.2 MB of source material).
