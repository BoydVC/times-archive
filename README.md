# Times Archive: The Family Times, bound and shelved

A searchable archive of every saved edition of **The Family Times**, Parent A's daily household newspaper bot. It's built only from files on this box, it stays local, and nothing in it is invented.

**Live:** http://127.0.0.1:4645 (loopback only, left running)
**Offline:** `dist/times-archive-snapshot.html` (22.8 MB, one file, all thumbnails and page images embedded, no network)

## What's in it
| View | Route | What it does |
|---|---|---|
| Front Page | `#/` | Latest edition's lead and front page, the "This day in Parent A history" card (same date, 1/2/3 weeks ago, a month ago, a date picker, "Surprise me"), the archive in numbers, most-covered beats, recent front pages |
| Newsstand | `#/wall` | A wooden rack of every front page by date with a printed/PDF-only stamp. Hover to see the headline, click to read |
| Reader | `#/read/<no>/<page>` | Animated page flip (buttons, ←/→ keys, click the page edges, or page thumbnails), the list of every edition, the headlines verified in that edition, dad joke and quote, print evidence, a "Read text" pane with search hits highlighted, and the original PDF |
| Search | `#/search?q=` | Full-text search over all 90 pages. Quotes match exact phrases. Filter by section, sort by hits or date, see a hit-by-date bar, and open a snippet straight to the right page |
| Trends | `#/trends` | Heatmaps of beats and family members by edition, other named people, beat of the week, and totals. Everything is counted only from the PDF text |
| Print Log | `#/timeline` | Day-by-day strip and tiles: printed, PDF-only, or no log, each with the exact evidence line and its source file |
| Sources & Gaps | `#/about` | What was read, what was left out, and the patterns used for trends |

## Coverage (built Oct 7, 2026)
- **30 editions, 90 pages, about 45k words.** Nos. 1–30, **Wed Sep 9 to Wed Oct 7, 2026**. Every day in that span is covered.
- Sep 9 has two editions. No. 1 is the first-run paper, printed as "The Family Times" (as of 6:46 P.M.). No. 2 is the first scheduled morning edition (5:03 A.M.).
- No. 3 also has a "-larger" PDF variant. It's listed in the reader, but the standard PDF is the one indexed.
- The 16 PDFs in the newspaper bot's attachments folder are byte-for-byte copies of Nos. 15–30 (checked by SHA-256), so they're not counted twice.
- Not editions, so left out: `/workspace/newspaper/17.4/LAYOUT-TEMPLATE-REFERENCE-ONLY.pdf` (template) and `/workspace/newspaper-17.4` (setup doc only).

## Print status (from logs only)
- **Printed (HP queue reported Complete 3/3), 10:** Nos. 17–25 (Sep 24 to Oct 2) and No. 30 (Oct 7). Every one of these log entries also says *"tray not physically confirmed."*
- **PDF-only, 8:** No. 7 (Sep 14, `deferred_no_BlueCubed`), No. 16 (Sep 23, BlueCubed offline), and Nos. 26–29 (Oct 3–6, BlueCubed offline). Nos. 3 and 8 are marked `*` because their *planned* mode was pdf_only and no outcome was logged.
- **No print outcome logged, 12:** Nos. 1, 2, 4, 5, 6, 9–15 (Sep 9–22). Where a machine note exists (for example, No. 10: "BlueCubed offline… expect PDF-only"), it's shown, but the edition isn't counted as printed or PDF-only.
- Sources: `/workspace/newspaper/edition-log.jsonl` (print field starts at No. 16), `/workspace/format-v2/edition-log.jsonl` (No. 7), each edition's `DRAFT.md`, and the `meta.machines_note` in `content.json`.

## Honesty rules
- **Headlines** come from each edition's `content.json` and are kept only when they appear in the printed PDF text. 293 were kept. 3 draft-only headlines were left out: No. 3 "River Days at Fort Smallwood Park", No. 4 "Weekend stack: Ashburn, Terps, Ravens", and No. 5 "Sunday stack: Delta, Ravens, Kid Club".
- **Search and trends** use `pdftotext` output of the PDFs themselves. Letter-spaced small caps such as "W E D N E S DAY" are rejoined and re-split using the archive's own vocabulary.
- **Trends** count fixed regex patterns (listed under Sources & Gaps). "Other named people" are auto-detected pairs of a common first name and a capitalized surname, found in at least two editions, with schools and places screened out.
- Comic speech is drawn into the images. Only the captions are text, so Marty is undercounted (found in 20 of 30 editions).

## Files
```
build.py            extract → data/archive.json, web/archive-data.js, page renders (poppler)
export_snapshot.py  → dist/times-archive-snapshot.html (asserts < 40 MB)
server.py           static server + /pdf/<no> (streams the original PDF read-only), 127.0.0.1:4645
run.sh [--rebuild]  start the server in the background (and optionally rebuild first); stop.sh stops it
screenshot.sh       1440×900 screenshots → screenshots/01…08; tests/flip_check.mjs also writes 09-page-flip.png
tests/smoke_test.py 25 checks: data integrity, headline verification, server routes, loopback binding,
                    headless-Chrome checks of every view, snapshot size and offline search, page-flip animation
web/                index.html, app.js, style.css, fonts (the paper's own Chomsky / Newsreader / Libre Franklin), img/
```
Page renders (`web/img/pages`, `web/img/thumbs`, `data/snap-pages`) were removed from the public repo for privacy; regenerate them locally with `build.py`.

## Refresh after new editions
```
./run.sh --rebuild       # re-extracts new editions (existing renders are cached), rebuilds the snapshot
python3 tests/smoke_test.py
```
Read-only: the builder never writes outside this folder. It sends nothing and prints nothing.


---
## Repo notes
- **Built:** Oct 7, 2026, by TokenMax (Parent A's Grok Bot) on the Grok Bot box.
- **Run:** `./run.sh` (then open the localhost URL it prints).
- Imported from `/workspace/tokenmax/times-archive` on Oct 23, 2026. node_modules, virtualenvs, logs and files over 20 MB were left out.
