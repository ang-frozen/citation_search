# Citation Search

Browser extension prototype for citation lookup while reading PDFs in the browser.

## Product direction

The target experience is close to Google Scholar's PDF reader:

- Open a PDF in the browser.
- Identify references such as `[1]`, `[5]`, and bibliography entries.
- Search for the cited paper's title and abstract.
- Offer one-click copy for citation styles and BibTeX.

## Important browser constraint

Chromium's built-in PDF viewer is an internal extension page, so a normal WebExtension cannot reliably inject UI into those rendered reference markers or intercept direct clicks on `[1]` inside the native viewer.

That means there are two realistic paths:

1. Use the browser's default PDF viewer for rendering, and keep citation tools in a side panel or popup.
2. Ship a custom viewer page with `pdf.js`, which gives full control over text spans, annotations, and click handling.

This repository implements path `1` as the MVP because it is compatible with the "use the default viewer" requirement.

## What this MVP does

- Opens a side panel from the extension action.
- Lets the user paste a bibliography entry, title, or DOI.
- Supports "search citation for selected text" from the browser context menu.
- Searches Crossref and OpenAlex.
- Shows likely title, authors, year, venue, and abstract.
- Copies APA, MLA, Chicago, and BibTeX.

## Files

- `manifest.json`: MV3 extension manifest.
- `src/background/service-worker.js`: action, side-panel, and context-menu wiring.
- `src/lib/providers.js`: Crossref/OpenAlex lookups and BibTeX fetch.
- `src/lib/formatters.js`: local citation formatting.
- `src/sidepanel/*`: user interface.

## Load locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this folder: `c:\Users\angko\OneDrive\Desktop\ext\reader`.

