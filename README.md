# Marketplace packages

A packages manager for Logseq marketplace plugins.

## Marketplace Catalog

View the **live catalog** of Logseq marketplace plugins [here](https://rudifa.github.io/marketplace/docs/index.html).

## How to write a plugin for Logseq?

This [repo](https://github.com/logseq/logseq-plugin-samples) contains sample code illustrating the Logseq Plugin API. You can read, play with or adapt from these samples to create your own plugins.

Plugin APIs: <https://plugins-doc.logseq.com/>.

> ⚠️ To avoid loading plugin failures occasionally and for performance reasons,
> it is recommended to keep the plugin SDK [@logseq/libs](https://www.npmjs.com/package/@logseq/libs) as up-to-date as possible.

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
   - `web` - [optional] Whether the web browser platform is supported. default: `false`
   - `effect` - [optional] Whether the sandbox is running under the same origin with host. default: `false`
   - `unsupportedGraphType` - [optional] Flag to indicate that which graph type does not to be supported. value: `file` | `db`
     > ⚠️ `effect`? - it's not recommended to turn on this option if you don't
     > need a specific feature (_the current built-in plugin API does not satisfy_),
     > which may affect the stability of the program. If it does need to be turned on,
     > the market review process will be more strict, while there is no guarantee
     > that it will not be allowed to be turned on in the future.
3. Make a Github Pull Request :)

## How to update plugins' stat?

Note: This step is optional!

To update the plugins' stat,
you need run `scripts/build.mjs` script with a valid
[GitHub access token](https://github.com/settings/tokens).
Assuming you have a token,
take the following steps:

```sh
yarn install
cd scripts
LSP_MK_TOKEN=YOUR_TOKEN ./build.mjs --stat
```

Ensure only `stats.json` file is updated.
If `errors.json` is changed,
rerun the steps to ensure no plugin is missed.

## How to report an unavailable or malicious plugin

If a plugin is unavailable or you think it contains malicious code, please email [support@logseq.com](mailto:support@logseq.com). Mention the name of the plugin and the URL of its GitHub repository.

The Logseq team usually responds within a business day.
