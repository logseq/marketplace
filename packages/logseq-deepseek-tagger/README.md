# Logseq DeepSeek Tagger Plugin

[![Marketplace Version](https://img.shields.io/logseq-plugin/version/logseq-deepseek-tagger-1-0-0)](https://logseq.github.io/plugins/marketplace/logseq-deepseek-tagger-1-0-0)
[![Marketplace Downloads](https://img.shields.io/logseq-plugin/downloads/logseq-deepseek-tagger-1-0-0)](https://logseq.github.io/plugins/marketplace/logseq-deepseek-tagger-1-0-0)

Enhance your Logseq organization by automatically generating relevant tags for your notes using the power of DeepSeek's AI! This plugin analyzes your block or page content and suggests contextual tags, while also adding useful temporal tags.

## Features

* **AI-Powered Smart Tagging**: Uses the DeepSeek API to analyze your text and suggest relevant tags.
* **Automatic Temporal Tags**: Automatically adds tags for the current year, month, month-year, quarter-year, quadrimester-year, and semester-year.
* **Three Tagging Modes**:
  * `/tags`: Analyzes the current text block and adds tags in a child `tags:: ...` block.
  * `/tagpage`: Analyzes the textual content of all blocks on the current page and adds tags in a new `Page Tags:: ...` block at the bottom of the page.
* **Easy Configuration**: Simply enter your DeepSeek API key in the plugin settings.
* **Customizable Formatting**: Generated tags are in UPPERCASE and comma-formatted for seamless integration with Logseq's `tags::` property.

## Requirements

* A DeepSeek account and valid API key. You can get an API key on the [DeepSeek website](https://platform.deepseek.com/).
* Logseq version 0.10.9 or higher (specify minimum version if known).

## Installation

### From Logseq Marketplace (Recommended)

1. Open Logseq.
2. Click the three dots (`...`) in the top right, then go to `Plugins` (or `Ctrl+Shift+P` / `Cmd+Shift+P` and search for `Plugins`).
3. Click the `Marketplace` tab.
4. Search for "DeepSeek Tagger" (or whatever name you give it).
5. Click "Install".

### Manually (for development or if not available on marketplace)

1. Download the latest plugin release from the [GitHub releases page](https://github.com/sched75/logseq-deepseek-tagger-plugin/releases).
2. Extract the downloaded `.zip` file.
3. In Logseq, enable "Developer Mode" in `Settings` -> `Advanced`.
4. Go to `Plugins`, click "Load unpacked plugin", and select the plugin folder you just extracted.

## Configuration

1. After installing the plugin, go to the `Plugins` section in Logseq.
2. Find "DeepSeek Tagger" in the list and click the gear icon (⚙️) to open its settings.
3. Enter your **DeepSeek API Key** in the designated field.
   * Your API key is stored locally by Logseq and never shared elsewhere.
4. Changes are saved automatically.

![image](saisie%20de%20la%20clef%20deepseek.gif)

## How to Use

Once your API key is configured, you can use the following slash commands in any block:

### 1. Tag Current Block: `/tags`

* Type `/tags` in a block containing text.
* Press `Enter`.
* The plugin will analyze this block's content and add a child block containing `tags:: TAG1, TAG2, YEAR, MONTH, ...`. If a child `tags::` block already exists, it will be updated.

![image](tag%20page.gif)

### 2. Tag Entire Page: `/tagpage`

* On any page, type `/tagpage` in a block (the content of the block where you type isn't used, only the page matters).
* Press `Enter`.
* The plugin will analyze the textual content of all blocks on the current page.
* A new top-level block will be added at the bottom of the page containing `Page Tags:: TAG1, TAG2, YEAR, MONTH, ...`.

![image](tag%20page.gif)

## DeepSeek Prompt Format (for reference)

The plugin uses the following prompt to interact with the DeepSeek API (with low temperature for more deterministic results):
"""
Analyze the following text and suggest 3 to 10 relevant keywords or concepts (one or two words) that could serve as tags. Return them as a comma-separated list, without any introduction or explanation, each tag should be in uppercase. For example: "TECHNOLOGY, ARTIFICIAL INTELLIGENCE, FUTURE".
YOU MUST ABSOLUTELY ADD to the proposed tags: the year (four digits), the month (in French and uppercase), the month (in French and uppercase) with the year (e.g. FEBRUARY 2025), the quarter with the year (e.g. Q1 2025), the quadrimester with the year (e.g. Q1 2025), the semester with the year (e.g. S1 2025). Temporal tags must also be in uppercase.
Text: "{BLOCK_TEXT}"
Date for temporal reference: "{CURRENT_DATE_YYYY-MM-DD}"
Suggested tags:
"""

## Issues and Contributions

* To report a bug or suggest a feature, please open an "Issue" on the [plugin's GitHub repository](https://github.com/YOUR_USERNAME/YOUR_PLUGIN_REPO/issues) (replace with your link).
* Contributions are welcome! If you'd like to contribute code, please fork the repository and submit a Pull Request.

## License

This plugin is distributed under the MIT license. See the `LICENSE` file for details.

---

Made with ❤️ for the Logseq community.