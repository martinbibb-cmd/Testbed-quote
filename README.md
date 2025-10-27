# Pricebook (Markdown-backed)

Author sections as Markdown with a small YAML front-matter block. Each file’s first pipe-table is compiled into JSON for use in the UI and pricing logic.

## Structure
- `/pricebook-md/**.md` — authoring files
- `/js/pricebook-loader.js` — zero-dep parser & loader
- `index.html` — demo UI + JSON export

## Front-matter fields
- `section` (string): display section title
- `id` (string): unique id (fallback derived from path)
- `last_refreshed` (YYYY-MM-DD): surfaced in banner
- `notes` (string): shown under section header
- Optional vendor context (e.g. `brand: Worcester`) is copied to each row

## Tables
Use GitHub-flavored pipe tables. First table in the file becomes the primary data table:
