# House style

## The look

The atlas looks like the picture wall of an old London club: ivory paper for reading, green baize for the web, every picture hung in a gilt frame with a small brass nameplate, brass threads between them. Old money, never flashy.

Everything that hangs on the wall has to look like it belongs to the same collection:

- **Drawings** are ink line drawings on an ivory mount, in the technical-flat style of `illustrations/ocbd-front.svg`. The site colours them; the files carry no colours.
- **Archival prints** are public-domain fashion plates, engravings, portraits, photographs and museum objects. `npm run picture` (or the browser, for hotlinked prints) turns all of them into the same warm monochrome print, so a 1810 etching and a 1950 photograph hang together.
- One picture per entry. Choose the picture that shows the thing itself: the garment, the person, the shop, the game. Never a logo, a modern product shot or anything decorative.

## Writing

The reader cares about clothes and wants to know why things are the way they are. Write like a knowledgeable shop assistant at a good outfitter, not like a brochure.

- **Every factual sentence must come from a source in the entry's `sources` list.** When sources disagree, say so plainly ("Brooks dates it to 1896; other accounts say 1900"). When something is a story or a maker's own claim, say that too.
- Plain, direct sentences. British spelling (colour, centre). Sentence case for names and headings.
- No marketing words (iconic, timeless, effortless, elevate, must-have, staple). No "not X, but Y" constructions, no rhetorical questions, no em-dash asides.
- Summary: one or two sentences that tell a stranger what the thing is and why it matters. It is what the web's card shows.
- Body: 150-450 words. Start with the most interesting true thing. Use `##` headings only when there are two or more distinct parts.
- Specifics beat adjectives: years, measurements in inches as the trade uses them, names of makers, mills, people and places.
- Quote sparingly: under 15 words, at most one quote per source in an entry. Paraphrase the rest in your own words.
- Italicise titles of books and publications: `*Take Ivy*`, `*Men's Wear*`.
- Link generously with `[[id]]`, to existing entries and to topics that deserve an entry later. At most eight new not-yet-written ids per entry, so the queue stays meaningful.

## Breadth

The atlas is about men's clothing everywhere, not one look. Ivy and English tailoring are where it started, not where it ends. Styles are nodes like any other: Neapolitan and Milanese tailoring, English country, the St James's club look, French sportswear, Mod, Ametora and Japanese Ivy, workwear, military dress that became civilian. Give regions and periods with few entries priority (`npm run web` shows them).

## Sources

- At least two independent sources per entry. A maker's own history page counts, but treat its dates as the maker's claim.
- Good: museum collections and essays (V&A, The Met, FIDM, Kyoto Costume Institute), books with page references, academic articles, trade press archives, Encyclopaedia Britannica, established menswear writers (Put This On, Permanent Style, Ivy Style, Die, Workwear!, Heddels).
- Wikipedia is fine as one source, never the only one.
- Never cite a page you have not opened in this run. Never invent a title, author, date or page number.

## Drawing

Plates and drawings are original SVG line drawings in the style of a fashion **technical flat**: the garment laid flat, straight on, no body, no shading beyond the classes below. Pattern views show the pieces a garment is cut from. Do not trace photographs, copy another illustrator's drawing, or draw logos.

**Canvas.** Garments: `viewBox="0 0 600 720"`, centred, with about 30 units of margin. Other drawings: portrait 4:5 (for example `0 0 480 600`), so they fill a frame.

**Classes.** Colour comes from classes only. Never write a hex colour, a `style` attribute or a `<style>` block; `fill`/`stroke` attributes may only be `"none"` or `"currentColor"`. Do not use `opacity` on shapes.

| class | for |
|---|---|
| `cloth` | filled garment pieces, with their outline |
| `cloth-alt` | a second fabric or an inside surface: under-collar, gusset, loop |
| `shade` | a filled shadow area without outline, such as the inside of the neck |
| `line` | open outlines and edges that are not filled |
| `seam` | topstitching, a dashed line 3 to 6 units inside an edge |
| `fold` | soft creases and drape, faint; a few, not many |
| `guide` | fold and pleat lines on pattern pieces |
| `grain` | grainline arrows and "place on fold" brackets |
| `button` | buttons (circles, radius 4 to 6) |
| `hole` | buttonholes or tiny filled marks |
| `label`, `label-sm` | text on pattern pieces only, sentence case |

**Order.** Draw back to front: sleeves, cuffs, body, pockets, placket, collar. Where two shapes share an edge, give both the same curve so outlines don't double up.

**Proportions.** Get real proportions right before details. On the 600-wide canvas a 15.5 shirt is about 18 units per inch.

**Hotspots.** Put each ring on the thing it describes. Keep rings at least 40 units apart. Five to eight per view.

**Check.** Run `npm run render -- <id>` and open the PNGs in `.preview/` with the Read tool. Look for shapes that don't close, doubled outlines, floating pieces, rings that miss, overlapping text. Fix and render again, at most three rounds.
