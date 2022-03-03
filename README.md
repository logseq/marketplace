# Marketplace packages

A packages manager for Logseq marketplace plugins.

## How to write a plugin for Logseq?

This [repo](https://github.com/logseq/logseq-plugin-samples) contains sample code illustrating the Logseq Plugin API. You can read, play with or adapt from these samples to create your own plugins.

Plugins API: https://logseq.github.io/plugins/.

Ensure that your plugin has a `publish.yml` file, so when you create a release from a tag, it will do the build dance and make you a zip file. Then make a tag (something like v0.0.1), and create a release from it. Ensure the following are true before submitting your plugin:

    - The release has a zip file attached in addition to the "Source code (zip)" link. (It might take a minute for build system to create the zip after creating the release.)
    - It's clear from your README what the plugin does, and how to use it.
    - It has at least one image or gif showing it in action.

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
    - `sponsors` - [optional] Sponsor external links. default: `[]`
3. Make a Github Pull Request :)
