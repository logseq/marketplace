#!/usr/bin/env node

import fetch from "node-fetch";
import fs from "fs";

export {main};

// Script to fetch Logseq marketplace plugin package details from GitHub
// Usage: node fetch-package-data.js
// Output: catalog/plugins-data.json

const OUTPUT_DIR = "./generated";
const DATA_FILE = "plugins-data.json";

const LOGSEQ_MARKETPLACE_PACKAGES_URL =
  "https://api.github.com/repos/logseq/marketplace/contents/packages";

const COMMITS_API =
  "https://api.github.com/repos/logseq/marketplace/commits?path=packages";

const RAW_LOGSEQ_MARKETPLACE_PACKAGES_URL =
  "https://raw.githubusercontent.com/logseq/marketplace/master/packages";

/**
 * Parse command line arguments for verbose flag, max, and help
 */
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(
    `Usage: node update-catalog-index.js [--max <number>] [--verbose|-v] [--help|-h]\n\nOptions:\n  --max <number>   Limit the number of packages processed\n  --verbose, -v    Enable verbose logging\n  --help, -h       Show this help message`
  );
  process.exit(0);
}
const verbose = args.includes("--verbose") || args.includes("-v");
let maxItems;
const maxIdx = args.indexOf("--max");
if (maxIdx !== -1 && args.length > maxIdx + 1) {
  const val = parseInt(args[maxIdx + 1], 10);
  if (!isNaN(val) && val > 0) maxItems = val;
}

/**
 * Run main if this script is executed directly
 */
if (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === process.argv[1]
) {
  main({verbose, maxItems}).then(() => {
    if (verbose) console.log("Script execution completed.");
    process.exit(0);
  });
}

/**
 * Main entry point for fetching Logseq marketplace plugin data and generating HTML output.
 * @param {Object} options
 * @param {boolean} options.verbose - Enable verbose logging.
 */
async function main({verbose = false, maxItems} = {}) {
  try {
    // Fetch package list from GitHub logseq marketplace repo
    const packages = await fetchPackageList(verbose);

    // Process packages using the worker function
    const {results, errorOccurred} = await worker(
      packages,
      maxItems,
      verbose,
      retrievePackageData
    );

    if (errorOccurred) {
      console.log("Processing stopped due to an error or rate limit.");
    }

    const goodResults = results.filter(Boolean);

    // Write results to JSON file
    fs.writeFileSync(
      `${OUTPUT_DIR}/${DATA_FILE}`,
      JSON.stringify(goodResults, null, 2)
    );
    console.log("\nPackage Data saved to", `${OUTPUT_DIR}/${DATA_FILE}`);
  } catch (e) {
    console.error("Error caught in main:", e.message);
  }
}

/**
 * @typedef {object} PackagesListItem
 * @property {string} name - The name of the file or directory.
 * @property {string} path - The full path of the file or directory within the repository.
 * @property {string} sha - The SHA of the file or directory.
 * @property {number} size - The size of the file in bytes.
 * @property {string} url - The API URL for the content.
 * @property {string} html_url - The HTML URL for the content on GitHub.
 * @property {string} git_url - The Git URL for the content.
 * @property {string|null} download_url - The download URL for the content (null for directories).
 * @property {'file'|'dir'|'symlink'|'submodule'} type - The type of the content.
 */

/**
 * @typedef {object} Manifest
 * @property {string} title - A title for plugin list item display. This is used as the `name` in the generated catalog.
 * @property {string} description - A short description about your plugin.
 * @property {string} author - The author's name.
 * @property {string} repo - The GitHub repository identifier, like `{user}/{repo}`.
 * @property {string} [icon] - [Optional] A logo filename for better recognition (e.g., "icon.png").
 * @property {boolean} [theme] - [Optional] True if it's a theme plugin. Defaults to `false`.
 * @property {string[]} [sponsors] - [Optional] An array of sponsor external links. Defaults to `[]`.
 * @property {boolean} [web] - [Optional] Whether the web browser platform is supported. Defaults to `false`.
 * @property {boolean} [effect] - [Optional] Whether the sandbox is running under the same origin with host. Defaults to `false`.
 * @property {'file'|'db'} [unsupportedGraphType] - [Optional] Flag to indicate which graph type is not supported.
 */

/**
 * @typedef {object} PluginData
 * @property {string} name - The name of the package, derived from the manifest's `title` or GitHub directory name.
 * @property {string} id - Currently unused placeholder.
 * @property {string} description - The package description.
 * @property {string} author - The package author.
 * @property {string} repo - The GitHub repository identifier (e.g., "owner/repo").
 * @property {string} repoUrl - The full HTML URL to the GitHub repository.
 * @property {string} iconUrl - The direct URL to the package icon, if found and valid.
 * @property {string} readmeUrl - The direct URL to the package README.md, if found and valid.
 * @property {string} created_at - The creation date of the package (first commit date) in ISO format.
 * @property {string} last_updated - The last update date of the package (last commit date) in ISO format.
 * @property {string} error - A comma-separated string of errors encountered during processing this package.
 * @property {string} defaultBranch - The default branch name of the repository (e.g., 'main' or 'master').
 * @property {string} theme - "Yes" if it's a theme plugin, otherwise an empty string.
 * @property {string} effect - "Yes" if it has side effects, otherwise an empty string.
 * @property {string} sponsors - A comma-separated string of sponsor links.
 */

// ================================================================================
// Fetch the package details for packages, for the Logseq Marketplace Plugins table
// ================================================================================

/**
 * Worker function to process packages concurrently.
 * @param {Object[]} packages - Array of package objects to process.
 * @param {number} [maxItems] - Maximum number of items to process.
 * @param {boolean} verbose - Enable verbose logging.
 * @param {(pkg: PackagesListItem, verbose: boolean) => Promise<PluginData|null>} processFunction - Function to process each package.
 * @returns {Promise<{results: Object[], errorOccurred: boolean}>} - Processed results and error flag.
 */
async function worker(packages, maxItems, verbose, processFunction) {
  let idx = 0;
  let count = 0;
  let errorOccurred = false;
  const results = [];

  async function processPackages() {
    while (!errorOccurred) {
      if (
        idx >= packages.length ||
        (maxItems !== undefined && idx >= maxItems)
      ) {
        return;
      }
      const myIdx = idx++;
      const pkg = packages[myIdx];
      try {
        const result = await processFunction(pkg, verbose);
        if (result) results[myIdx] = result;

        let mark = result.error == "" ? "." : "!";
        process.stdout.write(mark);

        count++;

        if (count % 50 === 0 || count === maxItems) {
          console.log(` Processed ${count} packages`);
        }
      } catch (error) {
        console.error(`Error processing package ${pkg.name}:`, error.message);
        if (
          error.message.includes("Rate limited") ||
          error.message.includes("Too many requests")
        ) {
          console.error("Rate limit reached. Stopping all workers.");
          errorOccurred = true;
          break;
        }
        // For other errors, continue processing but log the error
        results[myIdx] = {
          name: pkg.name,
          error: error.message,
        };
      }
    }
  }

  const CONCURRENCY = 10;
  await Promise.all(Array(CONCURRENCY).fill().map(processPackages));

  return {results, errorOccurred};
}

/**
 * Fetch the list of package directories from the Logseq marketplace GitHub repository.
 * @param {boolean} verbose - Enable verbose logging.
 * @returns {Promise<PackagesListItem[]>} List of package objects from GitHub API.
 */
async function fetchPackageList(verbose = false) {
  if (verbose)
    console.log(
      "Fetching package list from GitHub repo:",
      LOGSEQ_MARKETPLACE_PACKAGES_URL
    );

  const res = await fetchWithCheck(
    LOGSEQ_MARKETPLACE_PACKAGES_URL,
    "fetchPackageList"
  );
  if (!res) return [];

  const data = await res.json();

  if (verbose) console.log(`Found ${data.length} packages.`);
  return data;
}

/**
 * Process a single package: fetch manifest, commit dates, and build PluginData result.
 * @param {PackagesListItem} pkg - The package object from GitHub API.
 * @param {boolean} verbose - Enable verbose logging.
 * @returns {Promise<PluginData|null>} Result object for the package, or null if not a directory.
 */
async function retrievePackageData(pkg, verbose = false) {
  if (pkg.type !== "dir") return null;
  if (verbose) console.log(`Processing package: ${pkg.name}`);

  let packageData = {
    name: pkg.name,
    id: "",
    description: "",
    author: "",
    repo: "",
    repoUrl: "",
    iconUrl: "",
    readmeUrl: "",
    created_at: "",
    last_updated: "",
    error: "",
    defaultBranch: "",
    theme: "",
    effect: "",
    sponsors: "",
  };

  let errors = [];

  const commitDates = await fetchCommitDates(pkg.name, verbose);
  if (commitDates) {
    packageData.created_at = commitDates.created_at;
    packageData.last_updated = commitDates.last_updated;
  }

  const /** @type {Manifest|null} */ manifest = await fetchManifest(pkg.name, verbose);
  if (!manifest) {
    return packageDataWithError("Missing manifest");
  } else {
    if (verbose) console.log(`manifest for ${pkg.name}`, manifest);
    // Validate manifest fields
    if (!manifest.description) errors.push("Missing description");
    if (!manifest.author) errors.push("Missing author");
    if (!manifest.repo) errors.push("Missing repository");
    if (!manifest.icon) errors.push("Missing icon name");

    // Create and validate the icon URL
    packageData.iconUrl = await getValidIconUrl(pkg.name, manifest.icon);
    if (!packageData.iconUrl) errors.push("Missing icon URL");

    // Fill in the rest of the package data from manifest
    packageData.name = manifest.name || pkg.name;
    packageData.description = manifest.description || "";
    packageData.author = manifest.author || "";
    packageData.repo = manifest.repo || "";
    packageData.theme = manifest.theme ? "Yes" : "";
    packageData.effect = manifest.effect ? "Yes" : "";
    packageData.sponsors = manifest.sponsors && manifest.sponsors.join(", ") || "";

    // Create and validate the repo URL and get the default branch
    const {repoUrl, defaultBranch} = await getRepoUrlAndDefaultBranch(
      manifest.repo
    );
    if (!repoUrl) {
      return packageDataWithError("Missing repo URL");
    } else {
      packageData.repoUrl = repoUrl;
      packageData.defaultBranch = defaultBranch;

      // Create and validate the README URL
      packageData.readmeUrl = await getValidReadmeUrl(
        manifest.repo,
        defaultBranch
      );
      if (!packageData.readmeUrl) {
        return packageDataWithError("Missing README");
      }
    }
  }

  return packageDataWithError();

  function packageDataWithError(error = "") {
    if (error) errors.push(error);
    packageData.error = errors.join(", ");
    return packageData;
  }
}

/**
 * Fetch the manifest.json for a given package.
 * @param {string} packageName - The name of the package directory.
 * @param {boolean} verbose - Enable verbose logging.
 * @returns {Promise<Manifest|null>} Manifest object, or null if not found.
 */
async function fetchManifest(packageName, verbose = false) {
  const manifestUrl = `${RAW_LOGSEQ_MARKETPLACE_PACKAGES_URL}/${packageName}/manifest.json`;
  if (verbose) {
    console.log(
      `fetchManifest: Fetching manifest for ${packageName}: ${manifestUrl}`
    );
  }

  try {
    const res = await fetchWithCheck(manifestUrl, "fetchManifest");
    if (!res) return null;

    const manifest = await res.json();

    if (verbose) console.log(`Fetched manifest for ${packageName}`);
    return manifest;
  } catch (err) {
    if (verbose) {
      console.log(`Error fetching manifest for ${packageName}:`, err);
    }
    return null;
  }
}

/**
 * Attempt to fetch the icon for a given package and icon name.
 * @param {string} packageName - The name of the package directory.
 * @param {string} [iconName] - The icon file name from the manifest.
 * @returns {Promise<string|null>} The icon URL if fetch succeeds, or null if not found/invalid.
 */
async function getValidIconUrl(packageName, iconName) {
  if (iconName) {
    const url = `${RAW_LOGSEQ_MARKETPLACE_PACKAGES_URL}/${packageName}/${iconName}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        // Discard body, just check existence
        return url;
      } else {
        return null;
      }
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Fetch the first and last commit dates for a given package directory.
 * @param {string} packageName - The name of the package directory.
 * @param {boolean} verbose - Enable verbose logging.
 * @returns {Promise<{created_at: string, last_updated: string}>} Commit date info.
 */
async function fetchCommitDates(packageName, verbose = false) {
  const commitsApi = `${COMMITS_API}/${packageName}&per_page=100`;
  try {
    if (verbose) {
      console.log(
        `fetchCommitDates: Fetching commit dates for ${packageName}: ${commitsApi}`
      );
    }

    const res = await fetchWithCheck(commitsApi, "fetchCommitDates");
    if (!res) {
      return {created_at: "", last_updated: ""};
    }

    const commits = await res.json();

    if (!Array.isArray(commits) || commits.length === 0) {
      return {created_at: "", last_updated: ""};
    }

    // Commits are returned newest first
    const last_updated = commits[0]?.commit?.committer?.date || "";
    const created_at =
      commits[commits.length - 1]?.commit?.committer?.date || "";
    return {created_at, last_updated};
  } catch (err) {
    console.error(`Error fetching commit dates for ${packageName}:`, err);
    return {created_at: "", last_updated: ""};
  }
}

/**
 * Fetch the repo URL and default branch name for a given GitHub repository.
 * @param {string} repo - The GitHub repository in the form 'owner/repo'.
 * @returns {Promise<{repoUrl: string, defaultBranch: string|null}>} The repo URL and default branch name.
 */
async function getRepoUrlAndDefaultBranch(repo) {
  const apiUrl = `https://api.github.com/repos/${repo}`;
  try {
    const res = await fetchWithCheck(apiUrl, "getRepoUrlAndDefaultBranch");
    if (!res) return {repoUrl: "", defaultBranch: null};

    const data = await res.json();
    return {
      repoUrl: data.html_url || "",
      defaultBranch: data.default_branch || null,
    };
  } catch (err) {
    console.error(`Error fetching repo info for ${repo}:`, err);
    return {repoUrl: "", defaultBranch: null};
  }
}

/**
 * Return the first valid README.md URL (main or master branch) for a given GitHub repo, or null if not found.
 * @param {string} repo - The GitHub repository in the form 'owner/repo'.
 * @param {string} defaultBranch - The default branch name (e.g., 'main' or 'master').
 * @returns {Promise<string|null>} The valid README.md URL or null if not found.
 */
async function getValidReadmeUrl(repo, defaultBranch) {
  // Try alternate spelling of README:README.md/README.org/readme.md/readme.org
  const cases = [
    `${defaultBranch}/README.md`,
    `${defaultBranch}/README.org`,
    `${defaultBranch}/readme.md`,
    `${defaultBranch}/readme.org`,
  ];

  const urls = cases.map(
    (s) => `https://raw.githubusercontent.com/${repo}/${s}`
  );
  try {
    for (const url of urls) {
      const res = await fetch(url);
      if (res.ok) return url;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch data from a URL with error checking and handling.
 * @param {string} url - The URL to fetch from.
 * @param {string} caller - The name of the calling function (for error reporting).
 * @param {object} [options] - Additional options for fetch.
 * @returns {Promise<Response|null>} The fetch response or null if failed.
 * @throws {Error} Throws an error for rate limiting (403) or too many requests (429).
 */
async function fetchWithCheck(url, caller, options = {}) {
  try {
    const res = await fetch(url, {...options, headers: getGithubHeaders()});
    if (!res.ok) {
      let errorText = "";
      try {
        errorText = await res.text();
      } catch (e) {
        errorText = "(could not read error body)";
      }

      // Throw for rate limiting or too many requests
      if (res.status === 403 || res.status === 429) {
        throw new Error(
          `${caller}: Rate limited or too many requests. Status: ${res.status}`
        );
      }

      return null;
    }
    return res;
  } catch (error) {
    console.error(`${caller}: Error during fetch:`, error.message);
    throw error; // Re-throw the error to be caught by the calling function
  }
}

/**
 * Get headers for GitHub API requests, including authorization if GITHUB_TOKEN is set.
 * @returns {object} Headers object for fetch requests.
 */
function getGithubHeaders(verbose = false) {
  const headers = {Accept: "application/vnd.github.v3+json"};
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
  }
  if (verbose) {
    console.log(
      "getGithubHeaders: Using GitHub token:",
      !!process.env.GITHUB_TOKEN,
      "\nHeaders.Accept:",
      headers.Accept
    );
  }
  return headers;
}
