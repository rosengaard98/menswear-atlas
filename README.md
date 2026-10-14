# The Menswear Atlas

A web of men's clothing history. Garments, details, styles, makers, people and places hang as framed pictures on a timeline, joined by threads that say how they connect: what introduced what, what came from where, what was revived as what. Click a picture to see its threads; open its entry for the full story, its sources and, for garments, a plate with rings on each detail.

A team of agents researches and adds to it every night, and a gardener tends it once a week.

## The team

The nightly run (`ORCHESTRATOR.md`) is led by the **curator**, who picks about three topics, keeping the web broad across decades, regions and kinds, and then sends out:

| agent | does | brief |
|---|---|---|
| Researchers (in parallel) | find sourced facts, connections and a public-domain picture candidate | `agents/researcher.md` |
| Writer | turns the notes into entries | `agents/writer.md` |
| Weaver | connects the new entries to the whole web, folds duplicates | `agents/weaver.md` |
| Illustrator | hangs a picture on each entry: a print, a drawing or a crop | `agents/illustrator.md` |
| Fact-checker | tests every sentence, thread and licence against the sources | `agents/fact-checker.md` |
| Visual reviewer | checks that tonight's pictures belong on the wall | `agents/visual-reviewer.md` |
| Tester | runs the browser test suite and explains any failure | `agents/tester.md` |

The weekly **gardener** (`GARDENER.md`) merges duplicates, adds missing threads, strengthens thin entries, fixes dead sources and opens a GitHub issue with what it did.

Every run writes a log to `runs/`: each agent's status, numbers and problems. The site's **Run log** page (linked in the footer) shows them, with a row of marks per agent across recent runs, so you can see which agent is struggling. The gardener reviews the week's logs and suggests changes to the briefs in its issue.

Each morning you get an email with a short summary and a link to that night's PDF report: what was added, how each agent did, what needs your attention and what comes next.

To steer the atlas, edit **Next up** in `BACKLOG.md`.

## Files

```
content/        one Markdown file per entry, by kind (SCHEMA.md)
illustrations/  original SVG drawings
pictures/       public-domain prints after the house treatment
research/       the researchers' notes, kept for traceability
runs/           one log per run: what each agent did (SCHEMA.md, Run logs)
reports/        the morning report PDFs, published at /reports/<date>.pdf
site/           page template, styles and script
tools/          validate, wanted, web report, render, picture, build, test
dist/           the built site (not committed)
```

## Run it locally

```bash
npm install
npm run check   # validate every entry and build dist/
npm test        # build, then click through everything in a headless browser
npm run web     # coverage and loose ends
```

Open `dist/index.html` in a browser. `.github/workflows/pages.yml` publishes `dist/` to GitHub Pages on every push to `main`.
