# Marketplace packages

A packages manager for Logseq marketplace plugins.

## How to submit your plugin?

0. Fork this repo to your Github account.
1. Create a package directory under `./packages` root based on your plugin name.
2. Write a [manifest.json](./packages/logseq-dev-theme/manifest.json) file to the package root. Valid fields as follows:
    - `title`- A title for plugin list item display.
    - `description`- A short description about your plugin.
    - `author`- The author's name.
    - `repo`- The GitHub repository identifier, like `{user}/{repo}`.
    - `icon`- [optional] A logo for better recognition. default: `""`
    - `theme`- [optional] A theme plugin? default: `false`
3. Make a Github Pull Request :)
