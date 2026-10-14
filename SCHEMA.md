# Entry schema

Every entry is one Markdown file with YAML frontmatter at `content/<folder>/<id>.md`.
`npm run validate` enforces everything marked *required*.

## Types

| type | folder | use it for |
|---|---|---|
| `garment` | `content/garments/` | A whole piece of clothing: OCBD, sack suit, penny loafer, Barbour jacket. |
| `detail` | `content/details/` | A part, construction method or cloth: box pleat, collar roll, oxford cloth, gauntlet button. |
| `era` | `content/eras/` | A broad period of time: Regency, Interwar. Eras should tile the timeline without big overlaps. |
| `style` | `content/styles/` | A recognisable way of dressing with a span of years: Ivy League look, Mod, Neapolitan tailoring. |
| `maker` | `content/makers/` | A company, tailor, mill or shop: Brooks Brothers, Anderson & Sheppard. |
| `person` | `content/people/` | Someone who shaped men's dress: Beau Brummell, the Duke of Windsor. |
| `context` | `content/context/` | Places, sports, books, institutions and events: polo, Savile Row, *Take Ivy*. |

## Fields

```yaml
---
id: box-pleat                 # required. lowercase-kebab, unique across all types, same as the file name
type: detail                  # required. one of the types above, matching the folder
name: Box pleat               # required. sentence case, how a reader would say it
aka: [inverted pleat]         # optional. other names; they are searchable
period: { from: 1896, to: null }  # required for era (from + to) and style (from); optional otherwise.
                              # to: null means "still going". Years only.
summary: >-                   # required. 1-2 sentences, under 320 characters. Shown on the entry and in search.
  ...
links: [ocbd, yoke]           # optional. ids this entry relates to that are not already [[linked]] in the body
views:                        # optional. illustrated views; see below
  - label: Front
    svg: polo-shirt-front.svg
    caption: Technical flat, front.
    hotspots:
      - target: placket       # id of the entry the ring leads to (written or not)
        x: 300                # position in the SVG's viewBox coordinates
        y: 160
        label: Two-button placket
        note: One or two sentences, under 260 characters, shown when the ring is opened.
sources:                      # required. at least one; two independent ones are expected
  - title: The perfect Oxford shirt
    publisher: ASKET          # optional but expected
    url: https://...          # url or citation required
  - title: Take Ivy
    citation: Hayashida et al., powerHouse Books, 2010, p. 42
added: 2026-10-14             # required. date the entry was first written
---
Body in Markdown, at least 200 characters. Use ## for section headings.
```

## Links between entries

- `[[id]]` in the body links to another entry. Mid-sentence, common nouns are lowercased automatically (`the [[box-pleat]]` reads "the box pleat"). Write `[[id|text]]` whenever you need other wording or a capital, for example at the start of a sentence or for a brand.
- Linking to an id that has no entry yet is allowed and encouraged. It shows as "not written yet" on the site and goes on the queue that `npm run wanted` prints. That is how the atlas grows.
- Every ring on a plate is a link too. Its `label` and `note` stand in for the entry until it is written, so the note must be accurate on its own.

## Views and hotspots

- `svg` names a file in `illustrations/`. The file rules are in STYLE.md; the validator rejects scripts, external links, images, style blocks and hard-coded colours.
- Hotspot `x`/`y` are in the SVG's own coordinate system (the `viewBox`), so they stay put at any screen size.
- Order hotspots the way a reader's eye travels: top to bottom, then left to right. The home page lists them in that order.
- Check placement with `npm run render -- <id>`, which writes PNGs with numbered red rings to `.preview/`.

## Commands

```bash
npm run validate   # check every entry; exits 1 on errors
npm run wanted     # ids that are linked but not written, most-linked first
npm run render -- ocbd   # draw an entry's views with hotspot rings into .preview/
npm run build      # validate, then write dist/index.html
npm run check      # validate + build; must pass before every commit
```
