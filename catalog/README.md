# Logseq Marketplace Catalog

This project generates an **interactive, searchable, sortable table** of all packages in the [logseq/marketplace](https://github.com/logseq/marketplace) repository. The table is saved as a static HTML file at `catalog/generated/index.html`.

## Features

- Fetches all plugin packages from the Logseq marketplace GitHub repo
- Displays package info (icon, name, description, author, repo, version, created/updated dates)
- Table is interactive (search, sort, scroll) using DataTables
- Click a package description to view its README.md in a modal dialog (fetched live from GitHub)

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

The GitHub Actions workflow `.github/workflows/deploy.yml` is configured to automatically build and publish the catalog to GitHub Pages whenever changes are pushed to the `main` branch. This eliminates the need for manual deployment steps.

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

## Usage

To generate/update the catalog index.html:

```sh
cd catalog
node scripts/update-catalog-index.js
```

which will update `catalog/index.html` and `catalog/`.

## Usage with npm scripts

```
cd catalog
npm run build     # builds the full catalog
npm run dev       # builds a small catalog (12 plugins), for faster development
npm run preview   # opens the catalog in your default browser
```

## How the README Modal Works

- In the generated HTML, clicking a package description opens a modal dialog.
- The modal fetches the plugin's `README.md` from GitHub (tries `main` branch, then `master`).
- The markdown is rendered to HTML using the [marked](https://github.com/markedjs/marked) library.

## Development

- The main script is `catalog/scripts/update-catalog-index.js` (Node, ESM)
- This script invokes two other scripts:
  - `catalog/scripts/fetch-plugins-data.js`
    - fetches plugin data from GitHub and saves them in `catalog/generated/plugins.json`
  - `catalog/scripts/generate-plugins-table-html.js`
    - reads `catalog/generated/plugins.json` and generates the HTML table in `catalog/index.html`
- The final output is `catalog/generated/index.html`
- You can customize the table columns or modal logic in the script as needed

---

MIT License
