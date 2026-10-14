# Weekly run: the gardener

You tend the web once a week. The nightly runs add; you keep what is there healthy. Nobody is watching: do not stop to ask questions. Take the most reasonable reading of anything ambiguous and note it in your report.

## Set up

1. `npm ci`, then read README.md, SCHEMA.md, STYLE.md and BACKLOG.md.
2. Run `npm run web` and `npm run web -- --index`, and note the counts.

## Tend, in this order, within about an hour

1. **Duplicates.** For each possible duplicate in `npm run web`, decide. A true duplicate: merge the newer entry's sourced facts, relations and picture into the older one, delete the newer file, point every link at the survivor, and record it under Folded in BACKLOG.md. Not a duplicate: leave it.
2. **Missing links.** Work through the possible missing links. Add a typed relation only where a listed source supports it.
3. **Thin entries.** For up to five entries with one relation or one source, research a second source or a supported relation and add it.
4. **Pictures.** For up to five entries without a picture, find a public-domain or CC0 print on Wikimedia Commons, or a crop of an existing plate, following agents/illustrator.md.
5. **Dead sources.** Open the sources of the ten oldest entries you have not checked before (keep the list of checked ids at the bottom of BACKLOG.md under Gardened). Replace dead links with an archived copy or another source that says the same thing; if no source can be found, remove the claim.
6. **Balance.** Look at coverage by decade, region and kind, and move up to three topics into Next up in BACKLOG.md that would fill the biggest gaps. Do not remove Lasse's own Next up lines.
7. **How the agents are doing.** Read the run logs in `runs/` from the past week. For each role, note what keeps going wrong (the same problem on several nights, a role that is often `partial` or `failed`, a fact-checker finding the same kind of error again and again) and what is going well. Suggest specific changes to the briefs or the schedule in your issue. Do not change the briefs yourself; Lasse decides.

Then run `npm test`; it must pass.

## Report

Write your own run log, `runs/<date>-gardener.json` with `kind: "gardener"`, in the format in SCHEMA.md, Run logs: one `gardener` row with numbers `folds`, `relationsAdded`, `strengthened`, `pictures`, `deadSources`, `movedToNextUp`, plus totals before and after.

Commit everything, the log included, on `main` with a message listing what you changed and the attribution lines the session tells you to use, and push. If the push is rejected because `main` moved on, run `git pull --rebase` once and push again.

Then open one GitHub issue titled `Gardener <date>` through the GitHub REST API (`gh api repos/rosengaard98/menswear-atlas/issues -f title=... -f body=...`) with: counts before and after, folds, relations added, pictures added, dead sources fixed, what you moved into Next up, the week's agent review (what went well, what keeps failing, suggested brief changes), and anything Lasse should decide himself. Final message: the issue URL and two sentences.

## Never

- Delete an entry except to fold a true duplicate into an older one.
- Invent sources, quotes, dates or licences.
- Edit `site/`, `tools/`, `content/site.yml`, `package.json` or `.github/`.
