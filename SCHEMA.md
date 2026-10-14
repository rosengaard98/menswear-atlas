# Entry schema

Every entry is one Markdown file with YAML frontmatter at `content/<folder>/<id>.md`. Every entry is a node in the web. `npm run validate` enforces everything marked *required*.

## Kinds of entry

| type | folder | use it for |
|---|---|---|
| `garment` | `content/garments/` | A whole piece of clothing: OCBD, sack suit, penny loafer, waxed jacket. |
| `detail` | `content/details/` | A part, construction method or cloth: box pleat, collar roll, oxford cloth, spalla camicia. |
| `style` | `content/styles/` | A recognisable way of dressing, with years and places: Ivy League look, Neapolitan tailoring, English country, Mod, Ametora. |
| `era` | `content/eras/` | A broad period: Regency, Interwar. Eras are drawn as bands behind the web, not as pictures, and should not overlap much. |
| `maker` | `content/makers/` | A brand, tailor, mill or shop: Brooks Brothers, Anderson & Sheppard, Rubinacci. |
| `person` | `content/people/` | Someone who shaped men's dress: Beau Brummell, the Duke of Windsor, Kensuke Ishizu. |
| `context` | `content/context/` | Places, sports, books, clubs, institutions, events: polo, Savile Row, *Take Ivy*, St James's clubs. |

## Fields

```yaml
---
id: box-pleat                 # required. lowercase-kebab, unique across all kinds, same as the file name
type: detail                  # required. one of the kinds above, matching the folder
name: Box pleat               # required. sentence case, as a reader would say it
aka: [inverted pleat]         # optional. other names; searchable
period: { from: 1896, to: null }  # required for era (from + to) and style (from). optional otherwise. to: null = still going
anchor: 1800                  # optional. the year used for sorting and filtering, when period.from would mislead
                              # (people default to birth + 25)
regions: [uk, us]             # expected. any of: uk, us, italy, france, japan, india, germany,
                              # scandinavia, spain, argentina, global, other
summary: >-                   # required. 1-2 sentences, under 320 characters. Shown in the web's card and in search.
  ...
relations:                    # the threads of the web; see below
  - { to: ocbd, kind: part-of }
  - { to: brooks-brothers, kind: introduced-by, year: 1896 }
  - { to: yoke, kind: related, note: Hangs from the yoke seam }
picture:                      # expected. see Pictures below
  kind: drawing
  from: ocbd
  view: Back
  focus: [300, 230]
  size: 250
views:                        # optional. illustrated plates with hotspots (garments mostly)
  - label: Front
    svg: polo-shirt-front.svg
    caption: Technical flat, front.
    hotspots:
      - { target: placket, x: 300, y: 160, label: Two-button placket, note: One or two sentences under 260 characters. }
sources:                      # required. two independent ones expected
  - { title: The perfect Oxford shirt, publisher: ASKET, url: "https://..." }
  - { title: Take Ivy, citation: "Hayashida et al., powerHouse Books, 2010, p. 42" }
added: 2026-10-14             # required. date first written
---
Body in Markdown, at least 200 characters. Use ## for section headings.
```

## Relations: the threads of the web

A relation is a typed thread between two entries. Write it in either entry; the build adds the reverse label automatically, so write each relation once. Every relation must be supported by the entry's sources or the research notes.

| kind | reads as | reverse | typical use |
|---|---|---|---|
| `part-of` | Part of | Includes | detail → garment, garment → style |
| `introduced-by` | Introduced by | Introduced | garment/detail/style → maker or person |
| `made-by` | Made by | Makes | garment → maker |
| `worn-by` | Worn by | Wore | garment/style → person |
| `originated-in` | Came from | Gave rise to | detail/garment → sport, place, institution |
| `evolved-into` | Evolved into | Evolved from | style → style, garment → garment |
| `revived-as` | Revived as | Revival of | style → later style |
| `influenced` | Influenced | Influenced by | anything → anything, when a source says so |
| `named-after` | Named after | Gave its name to | polo shirt → polo |
| `belongs-to-era` | Era | From this era | anything → era (not drawn as a thread; the era is the band behind it) |
| `related` | Related | Related | only when none of the above fits; add a `note` saying how |

You may write the reverse name too (`includes`, `introduced`, `makes`, `wore`, `origin-of`, `evolved-from`, `revival-of`, `influenced-by`, `gave-name-to`, `era-of`). Optional `year` (integer) and `note` (under 160 characters).

`[[id]]` links in the body and hotspot targets also connect entries, as lighter "mentions". Linking to an id that has no entry yet is allowed and encouraged: it shows as a dashed oval in the web and goes on the queue (`npm run wanted`). That is how the web grows.

## Pictures

Every entry except eras should have a picture; it is what hangs in the web. Three kinds:

1. **A crop of a drawing** (details): `{ kind: drawing, from: <entry with views>, view: Back, focus: [x, y], size: 250 }`. `focus` is the centre of the crop in that view's coordinates; `size` its height. Check it with `npm run render -- <id>`.
2. **An original drawing**: `{ kind: drawing, svg: <file in illustrations/> }`, or `{ kind: drawing, view: Front }` to use the entry's own plate.
3. **A public-domain print** from Wikimedia Commons, licence public domain or CC0 only:
   - Preferred: `npm run picture -- <id> "https://commons.wikimedia.org/wiki/File:..." --write`. The tool checks the licence on Commons, refuses anything else, applies the house print treatment and writes the block.
   - If Commons rate-limits this machine (the tool says so), use the hotlink form instead after opening the Commons file page with WebFetch and confirming the licence yourself:
     ```yaml
     picture: { kind: archival, url: "https://upload.wikimedia.org/wikipedia/commons/...", title: ..., creator: ..., date: ..., licence: Public domain, source: "https://commons.wikimedia.org/wiki/File:..." }
     ```
     The site applies the same print treatment in the browser.

No logos or brand marks, no photographs of living people, nothing whose licence you have not seen stated on the source page.

## Run logs

Every run leaves one JSON file in `runs/`, named `<date>.json` (add `-2` if the name is taken). The site shows them on the run log page, and the gardener reads them to spot what keeps going wrong. `npm run validate` checks the shape.

```json
{
  "date": "2026-10-15",
  "kind": "nightly",
  "started": "00:54",
  "finished": "02:03",
  "commit": "<sha of the run's commit, added after committing; may be empty>",
  "totals": { "before": { "entries": 18, "relations": 56, "wanted": 25 }, "after": { "entries": 21, "relations": 70, "wanted": 31 } },
  "topics": [
    { "id": "neapolitan-tailoring", "source": "next-up", "outcome": "added" },
    { "id": "john-e-brooks", "source": "next-up", "outcome": "dropped", "reason": "one independent source" }
  ],
  "agents": [
    { "role": "researcher", "model": "sonnet", "topic": "neapolitan-tailoring", "status": "ok",
      "summary": "One line on what it did.", "numbers": { "sources": 4 }, "problems": ["Anything that went wrong or was hard"] }
  ],
  "notes": ["Anything about the run as a whole"]
}
```

`kind` is `nightly`, `gardener` or `test`. `role` is one of curator, researcher, writer, weaver, illustrator, fact-checker, visual-reviewer, tester, gardener. `status` is `ok`, `partial`, `failed` or `skipped`. `topic.source` is where the curator found the topic: `next-up`, `gap`, `wanted` or `ideas`. `outcome` is `added`, `dropped`, `folded` or `changed`. Each agent's numbers are the ones its brief lists under Report. Problems are short and specific, written so the same problem reads the same way on different nights.

## Commands

```bash
npm run validate      # check every entry; exits 1 on errors
npm run wanted        # topics linked but not written, most-linked first
npm run web           # coverage by decade, region and kind; loose ends; duplicates; missing links
npm run web -- --index  # one line per entry with its relations, to hold the whole web in view
npm run render -- <id>  # draw an entry's plates and picture to .preview/ with hotspot rings
npm run picture -- <id> <commons file page> --write   # fetch and treat a public-domain print
npm run build         # validate, then write dist/
npm test              # build, then click through the whole site in a headless browser
npm run report        # the morning report PDF for the newest run log, in reports/
npm run check         # validate + build
```
