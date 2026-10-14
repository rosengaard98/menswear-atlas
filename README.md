# The Menswear Atlas

A clickable history of men's clothing. Garments are drawn as technical flats with rings on their details; open a ring to see where that detail came from, then follow the links to the eras, styles, makers and people behind it. A team of agents researches and adds new entries every night.

Start with the oxford cloth button-down: the collar button leads to the polo field, the back pleat to the yoke, the pattern view to the pieces the shirt is cut from.

## How it grows

Every entry links to others with `[[id]]`, and many of those links point at topics nobody has written yet. Those unwritten topics are the queue. Each night a scheduled Claude run:

1. picks about three topics from `BACKLOG.md` and the queue (`npm run wanted`),
2. sends a researcher agent after each one, which writes sourced notes to `research/`,
3. writes the entries, and at most one new illustrated plate through an illustrator agent,
4. has a separate fact-checker agent test every sentence against the listed sources,
5. runs `npm run check`, commits to `main` and pushes. GitHub Pages rebuilds the site.

The full procedure is in `ORCHESTRATOR.md`, the briefs in `agents/`, the file format in `SCHEMA.md` and the writing and drawing rules in `STYLE.md`. To steer the atlas, edit the **Next up** list in `BACKLOG.md`.

## Layout

```
content/      one Markdown file per entry, by type (garments, details, eras, styles, makers, people, context)
illustrations/ SVG plates referenced by entries
research/     the researcher agents' notes, kept for traceability
site/         page template, styles and script
tools/        validate, wanted, build and render scripts
dist/         the built site (not committed)
```

## Run it locally

```bash
npm install
npm run check          # validate every entry and build dist/index.html
open dist/index.html   # the whole site is one file
npm run render -- ocbd # draw a plate with numbered hotspot rings into .preview/
```

## Publishing

`.github/workflows/pages.yml` builds and deploys on every push to `main`. In the repository settings, under Pages, set the source to GitHub Actions once.
