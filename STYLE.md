# House style

## Writing

The reader cares about clothes and wants to know why things are the way they are. Write like a knowledgeable shop assistant at a good outfitter, not like a brochure.

- **Every factual sentence must come from a source in the entry's `sources` list.** If the sources disagree, say so plainly ("Brooks dates it to 1896; other accounts say 1900"). If something is only a story or a maker's own claim, say that too.
- Plain, direct sentences. British spelling (colour, centre). Sentence case for names and headings.
- No marketing words (iconic, timeless, effortless, elevate, must-have, staple of every wardrobe). No "not X, but Y" constructions, no rhetorical questions, no em-dash asides.
- Summary: one or two sentences that tell a stranger what the thing is and why it matters. It is shown on the entry and used for search.
- Body: 150-450 words. Start with the most interesting true thing, not with a definition from a dictionary. Use `##` headings only when there are two or more distinct parts (origin, construction, how it changed).
- Specifics beat adjectives: years, measurements in inches as the trade uses them, names of makers, mills, people and places.
- Quote sparingly: under 15 words, at most one quote per source in an entry. Paraphrase everything else in your own words.
- Italicise titles of books and publications: `*Take Ivy*`, `*Men's Wear*`.
- Link generously with `[[id]]`, both to existing entries and to topics that deserve an entry later. Add at most eight new not-yet-written ids per entry, so the queue stays meaningful.

## Sources

- At least two independent sources per entry. A maker's own history page counts, but treat its dates as the maker's claim.
- Good: museum collections and essays (V&A, The Met, FIDM, Kyoto Costume Institute), books with page references, academic articles, trade press archives, Encyclopaedia Britannica, established menswear writers (Put This On, Permanent Style, Ivy Style, Die, Workwear!, Heddels).
- Wikipedia is fine as one of the sources, never as the only one.
- Never cite a page you have not opened in this run. Never invent a title, author, date or page number.

## Drawing

Plates are original SVG line drawings in the style of a fashion **technical flat**: the garment laid flat, seen straight on, no body, no shading beyond the classes below. Pattern views show the pieces a garment is cut from. Do not trace photographs, copy another illustrator's drawing, or draw logos or brand marks.

**Canvas.** Garments: `viewBox="0 0 600 720"`, centred, with about 30 units of margin. Small details or pattern sheets may use another viewBox, but keep it portrait or square.

**Classes.** Colour comes from classes only, so the site can theme the drawing for light and dark. Never write a hex colour, a `style` attribute or a `<style>` block; `fill`/`stroke` attributes may only be `"none"` or `"currentColor"`.

| class | for |
|---|---|
| `cloth` | filled garment pieces, with the outline (draw the outline as part of the shape) |
| `cloth-alt` | a second fabric or an inside surface: under-collar, gusset, loop |
| `shade` | a filled shadow area without outline, such as the inside of the neck |
| `line` | open outlines and edges that are not filled: placket edges, pleat folds near the top |
| `seam` | topstitching, drawn as a dashed line about 3 to 6 units inside an edge |
| `fold` | soft creases and drape, faint; use a few, not many |
| `guide` | fold lines and pleat lines on pattern pieces |
| `grain` | grainline arrows and "place on fold" brackets on pattern pieces |
| `button` | buttons (circles, radius 4 to 6) |
| `hole` | buttonholes or tiny filled marks |
| `label`, `label-sm` | text on pattern pieces only, sentence case: "Sleeve", "cut 2" |

**Order.** Draw back to front: sleeves, cuffs, body, pockets, placket, collar. Shapes drawn later sit on top. Where two shapes share an edge, make the paths share the same curve so the outlines don't double up.

**Proportions.** Get the real proportions right before the details: collar point length, button spacing, cuff depth, pocket size. When the research gives measurements, use them (a 15.5 shirt is about 18.5 inches across the shoulders, so roughly 18 units per inch on the 600-wide canvas).

**Hotspots.** Put each ring on the thing it describes, not next to it: on the collar button, on the pleat, on the cuff. Keep rings at least 40 units apart. Five to eight per view is plenty.

**Check your drawing.** Run `npm run render -- <id>` and open the PNGs in `.preview/` with the Read tool. Look for: shapes that don't close, outlines doubling up, things floating off the garment, rings that miss their target, text that overlaps. Fix and render again, at most three rounds.
