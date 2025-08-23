# Logseq Marketplace Catalog

This project generates an **interactive, searchable, sortable table** of all packages in the [logseq/marketplace](https://github.com/logseq/marketplace) repository. The table is saved as a static HTML file at `catalog/generated/index.html`,
and a copy is deployed to `docs/index.html`, which is served by GitHub Pages.

## Features

- Fetches all plugin packages from the Logseq marketplace GitHub repo
- Displays package info (Icon, Name, Description, Author, Repo, Version, Created/Updated Dates, Errors, Branch, Theme, Effect, Sponsors)
- Button `more/less` let the user hide or unhide the last 4 items
- Table is interactive (search, sort, scroll), implemented using DataTables
- A click on the package Description opens the package's README.md in a modal dialog (fetched live from the GitHub plugin repository)

## Publish on github.io page

The catalog can be published as a GitHub Pages site. To do this manually:

1. Build the catalog using `npm run build` (produces catalog/generated/index.html)
2. Copy catalog/generated/index.html to `docs/index.html`
3. Commit and push your changes to the `main` branch of your repository.
4. Go to the "Settings" tab of your repository on GitHub.
5. Scroll down to the "GitHub Pages" section.
6. Select the `main` branch as the source and source directory as `docs`.
7. Save your changes.

The catalog will be published at `https://<username>.github.io/<repo-name>/`.

## Automatically publish on github.io page

The GitHub Actions workflow `.github/workflows/update-catalog-index.yml` is configured to automatically build and publish the catalog to GitHub Pages whenever changes are pushed to the `main` branch. This eliminates the need for manual deployment steps.

However, the steps 4 to 7 need to be completed once by the repository owner.

## Issues

- none known

## Setup

1. **Install dependencies:**

```sh
cd catalog
npm install
```

2. **(Optional) Set a GitHub token** for higher API rate limits:

```sh
export GITHUB_TOKEN=your_token_here
```

`update-catalog-index.yml` provides the GITHUB_TOKEN for the build.

## Usage

To generate/update the catalog `index.html`, run:

```sh
cd catalog
node scripts/update-catalog-index.js
```

This will update the intermediate file `catalog/generated/plugins-data.json` and the final file `catalog/generated/index.html`.

## Usage with npm scripts during the development

```
cd catalog
catalog % npm run
Scripts available in logseq-marketplace-catalog@1.0.0 via `npm run-script`:
  build                                         # full length catalog (currently 466 packages)
    scripts/update-catalog-index.js
  build:min                                     # short length catalog (for development)
    scripts/update-catalog-index.js --max 36
  dev                                           # short length catalog (for development)
    scripts/update-catalog-index.js --max 24
  fetch                                         # fetch plugin data from GitHub repos (marketplace and packages)
    scripts/fetch-plugins-data.js
  fetch:min                                     # fetch some plugin data (for development)
    scripts/fetch-plugins-data.js --max 12
  html                                          # generate the HTML table from plugins-data.json
    scripts/generate-plugins-table-html.js
  show                                          # open the generated HTML file in the local browser
    open generated/index.html

```

## How the README Modal Works

- In the generated HTML, clicking a package Description opens a modal dialog.
- The modal fetches the plugin's `README.md` from the package repository default branch.
- It supports alternate spellings of the file name : README.md, README.org`, readme.md`, readme.org`
- The markdown is rendered to HTML using the [marked](https://github.com/markedjs/marked) library.

## Development

- The main script is `catalog/scripts/update-catalog-index.js` (Node, ESM)
- This script invokes two other scripts:
  - `catalog/scripts/fetch-plugins-data.js`
    - fetches plugin data from GitHub and saves them in `catalog/generated/plugins-data.json`
  - `catalog/scripts/generate-plugins-table-html.js`
    - reads `catalog/generated/plugins-data.json` and generates the HTML table in `catalog/index.html`
- The final output is `catalog/generated/index.html`

---

MIT License
