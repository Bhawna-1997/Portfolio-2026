# PayZapp case study — assets to export

Export from Figma into this `Assets/` folder using **exactly these filenames**.
The 6 images in Part 1 are already wired up in `work/payzapp.html` — they will
appear as soon as the files exist. No code change needed.

Part 2 are the grey placeholder boxes (`.pz-ph`). Drop those in and tell me;
I'll swap the boxes for `<img>` tags.

---

## Part 1 — already wired (13 `<img>` tags, 6 unique files)

These replaced expired `figma.com/api/mcp/asset/...` links. Those URLs were
temporary MCP asset links, not permanent CDN URLs — they now return 404.
Don't paste MCP asset URLs into the HTML again; they expire.

| Filename | What it is | Used | Notes |
|---|---|---|---|
| `discovery-data.png` | Data analysis screenshot — payment method selection patterns | 1× | Full width, renders at ~1100px. Export @2x. |
| `zapp-logo.svg` | PayZapp logo inside the Zapp Account tiles | 3× | Small tile logo |
| `icon-check.svg` | Green selected-state check | 3× | Top-right of each tile |
| `icon-bolt.svg` | Bolt icon in the tagline chip | 3× | Inline with "QUICK, secure, & pin-less" |
| `arrow-up.svg` | Green up arrow — 79% / 44% metrics | 2× | Metrics row |
| `arrow-down.svg` | Red down arrow — average transaction value | 1× | ATV block |

SVG is preferred for the five icon/logo files (they're vector in Figma and stay
crisp). If you'd rather export PNG, use @2x and tell me — I'll switch the
extensions in the HTML.

---

## Part 2 — placeholder boxes to fill (9)

Aspect ratios below are what the layout currently reserves, so exporting at
these proportions means nothing shifts.

| # | Section | Aspect ratio | Placement |
|---|---|---|---|
| 1 | The Root Cause — wallet invisible in payment flow | 472 × 570 | Right column, ~320px wide |
| 2 | Approach 1 — make wallet the default (rejected) | 421 × 427 | Right column, ~280px wide |
| 3 | Approach 2 — promotional banners (rejected) | 421 × 523 | Right column, ~280px wide |
| 4 | Approach 3 — contextual inline discovery (chosen) | 421 × 523 | Right column, ~280px wide |
| 5 | The Solution — persistent Zapp Account tile | 596 × 720 | Left column, ~596px wide |
| 6 | Payment processing | wide banner | Full width, height 120–200px |
| 7 | Success page stamp — seal of trust | 596 × 720 | Right column |
| 8 | Insufficient balance — 3-step flow | 1547 × 274 | Full width, spans all 3 flow labels |
| 9 | The Backstory — add-money flow | 1547 × 507 | Full width |

---

## Still open (not asset work)

- `work/healthcare.html` doesn't exist. The "Next project" link in
  `payzapp.html` now points to `payzapp-upi.html` instead, but the homepage
  carousel still lists it — see `content.js` line 148.
- `editor.js` + `editor.css` are still injected near the bottom of
  `payzapp.html`. Both are dev-only; remove those two lines before going live.
