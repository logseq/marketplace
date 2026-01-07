#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

export { main }

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Script to fetch Logseq marketplace plugin package details from local packages directory
// Usage: node fetch-package-data.js
// Output: catalog/plugins-data.json

const OUTPUT_DIR = './generated'
const DATA_FILE = 'plugins-data.json'

// Local packages directory - relative to the script location
const LOCAL_PACKAGES_DIR = path.resolve(__dirname, '../../packages')

/**
 * Parse command line arguments for verbose flag, max, and help
 */
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(
    `Usage: node update-catalog-index.js [--max <number>] [--verbose|-v] [--help|-h]\n\nOptions:\n  --max <number>   Limit the number of packages processed\n  --verbose, -v    Enable verbose logging\n  --help, -h       Show this help message`,
  )
  process.exit(0)
}
const verbose = args.includes('--verbose') || args.includes('-v')
let maxItems
const maxIdx = args.indexOf('--max')
if (maxIdx !== -1 && args.length > maxIdx + 1) {
  const val = parseInt(args[maxIdx + 1], 10)
  if (!isNaN(val) && val > 0) maxItems = val
}

/**
 * Run main if this script is executed directly
 */
if (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === process.argv[1]
) {
  main({ verbose, maxItems }).then(() => {
    if (verbose) console.log('Script execution completed.')
    process.exit(0)
  })
}

/**
 * Main entry point for fetching Logseq marketplace plugin data and generating HTML output.
 * @param {Object} options
 * @param {boolean} options.verbose - Enable verbose logging.
 */
async function main ({ verbose = false, maxItems } = {}) {
  try {
    // Fetch package list from GitHub logseq marketplace repo
    const packages = await fetchPackageList(verbose)

    // Process packages using the worker function
    const { results, errorOccurred } = await worker(
      packages,
      maxItems,
      verbose,
      retrievePackageData,
    )

    if (errorOccurred) {
      console.log('Processing stopped due to an error or rate limit.')
    }

    const goodResults = results.filter(Boolean)

    // Write results to JSON file
    fs.writeFileSync(
      `${OUTPUT_DIR}/${DATA_FILE}`,
      JSON.stringify(goodResults, null, 2),
    )
    console.log('\nPackage Data saved to', `${OUTPUT_DIR}/${DATA_FILE}`)
  } catch (e) {
    console.error('Error caught in main:', e.message)
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
async function worker (packages, maxItems, verbose, processFunction) {
  let idx = 0
  let count = 0
  let errorOccurred = false
  const results = []

  async function processPackages () {
    while (!errorOccurred) {
      if (
        idx >= packages.length ||
        (maxItems !== undefined && idx >= maxItems)
      ) {
        return
      }
      const myIdx = idx++
      const pkg = packages[myIdx]
      try {
        const result = await processFunction(pkg, verbose)
        if (result) results[myIdx] = result

        let mark = result.error == '' ? '.' : '!'
        process.stdout.write(mark)

        count++

        if (count % 50 === 0 || count === maxItems) {
          console.log(` Processed ${count} packages`)
        }
      } catch (error) {
        console.error(`Error processing package ${pkg.name}:`, error.message)
        if (
          error.message.includes('Rate limited') ||
          error.message.includes('Too many requests')
        ) {
          console.error('Rate limit reached. Stopping all workers.')
          errorOccurred = true
          break
        }
        // For other errors, continue processing but log the error
        results[myIdx] = {
          name: pkg.name,
          error: error.message,
        }
      }
    }
  }

  const CONCURRENCY = 10
  await Promise.all(Array(CONCURRENCY).fill().map(processPackages))

  return { results, errorOccurred }
}

/**
 * Fetch the list of package directories from the local packages directory.
 * @param {boolean} verbose - Enable verbose logging.
 * @returns {Promise<PackagesListItem[]>} List of package objects (mimicking GitHub API structure).
 */
async function fetchPackageList (verbose = false) {
  if (verbose)
    console.log(
      'Reading package list from local directory:',
      LOCAL_PACKAGES_DIR,
    )

  try {
    const items = fs.readdirSync(LOCAL_PACKAGES_DIR, { withFileTypes: true })

    // Filter only directories and convert to the expected format
    const packages = items.filter(item => item.isDirectory()).map(item => ({
      name: item.name,
      path: `packages/${item.name}`,
      type: 'dir',
      // Add other fields to match GitHub API structure if needed
      sha: '',
      size: 0,
      url: '',
      html_url: '',
      git_url: '',
      download_url: null,
    }))

    if (verbose) console.log(`Found ${packages.length} packages.`)
    return packages
  } catch (error) {
    console.error('Error reading local packages directory:', error.message)
    return []
  }
}

/**
 * Process a single package: fetch manifest, commit dates, and build PluginData result.
 * @param {PackagesListItem} pkg - The package object from GitHub API.
 * @param {boolean} verbose - Enable verbose logging.
 * @returns {Promise<PluginData|null>} Result object for the package, or null if not a directory.
 */
async function retrievePackageData (pkg, verbose = false) {
  if (pkg.type !== 'dir') return null
  if (verbose) console.log(`Processing package: ${pkg.name}`)

  let packageData = {
    name: pkg.name,
    id: '',
    description: '',
    author: '',
    repo: '',
    repoUrl: '',
    iconUrl: '',
    readmeUrl: '',
    created_at: '',
    last_updated: '',
    error: '',
    defaultBranch: '',
    theme: '',
    effect: '',
    sponsors: '',
    supportsDB: undefined,
    supportsDBOnly: undefined,
  }

  let errors = []


  const /** @type {Manifest|null} */ manifest = await fetchManifest(pkg.name,
    verbose)
  if (!manifest) {
    return packageDataWithError('Missing manifest')
  } else {
    if (verbose) console.log(`manifest for ${pkg.name}`, manifest)
    // Validate manifest fields
    if (!manifest.description) errors.push('Missing description')
    if (!manifest.author) errors.push('Missing author')
    if (!manifest.repo) errors.push('Missing repository')
    if (!manifest.icon) errors.push('Missing icon name')

    // Build repo URL directly from manifest.repo
    if (manifest.repo) {
      packageData.repoUrl = `https://github.com/${manifest.repo}`
      packageData.defaultBranch = 'main' // Default to 'main', could also try 'master'
      packageData.readmeUrl = `https://github.com/${manifest.repo}#readme`

      // Build icon URL from GitHub repo
      if (manifest.icon) {
        packageData.iconUrl = `https://raw.githubusercontent.com/${manifest.repo}/${packageData.defaultBranch}/${manifest.icon}`
      }

      // Fetch commit dates from GitHub API
      const commits = await fetchCommitDates(manifest.repo, verbose)
      if (commits) {
        packageData.created_at = commits.created_at
        packageData.last_updated = commits.last_updated
      }
    } else {
      errors.push('Missing repo URL')
    }

    // Fill in the rest of the package data from manifest
    packageData.name = manifest.name || pkg.name
    packageData.description = manifest.description || ''
    packageData.author = manifest.author || ''
    packageData.repo = manifest.repo || ''
    packageData.theme = manifest.theme ? 'Yes' : ''
    packageData.effect = manifest.effect ? 'Yes' : ''
    packageData.sponsors = manifest.sponsors && manifest.sponsors.join(', ') ||
      ''
    packageData.supportsDB = manifest.supportsDB
    packageData.supportsDBOnly = manifest.supportsDBOnly
  }

  return packageDataWithError()

  function packageDataWithError (error = '') {
    if (error) errors.push(error)
    packageData.error = errors.join(', ')
    return packageData
  }
}

/**
 * Fetch the manifest.json for a given package from local filesystem.
 * @param {string} packageName - The name of the package directory.
 * @param {boolean} verbose - Enable verbose logging.
 * @returns {Promise<Manifest|null>} Manifest object, or null if not found.
 */
async function fetchManifest (packageName, verbose = false) {
  const manifestPath = path.join(LOCAL_PACKAGES_DIR, packageName,
    'manifest.json')
  if (verbose) {
    console.log(
      `fetchManifest: Reading manifest for ${packageName}: ${manifestPath}`,
    )
  }

  try {
    // Check if manifest file exists
    if (!fs.existsSync(manifestPath)) {
      if (verbose) console.log(`Manifest not found for ${packageName}`)
      return null
    }

    // Read and parse manifest file
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(manifestContent)

    if (verbose) console.log(`Read manifest for ${packageName}`)
    return manifest
  } catch (err) {
    if (verbose) {
      console.log(`Error reading manifest for ${packageName}:`, err)
    }
    return null
  }
}

/**
 * Check if the icon file exists locally for a given package and icon name.
 * @param {string} packageName - The name of the package directory.
 * @param {string} [iconName] - The icon file name from the manifest.
 * @returns {Promise<string|null>} The relative icon path if exists, or null if not found.
 */
async function getValidIconUrl (packageName, iconName) {
  if (iconName) {
    const iconPath = path.join(LOCAL_PACKAGES_DIR, packageName, iconName)
    try {
      if (fs.existsSync(iconPath)) {
        // Return relative path from packages directory
        return `packages/${packageName}/${iconName}`
      } else {
        return null
      }
    } catch (e) {
      return null
    }
  }
  return null
}

/**
 * Fetch commit dates (created_at and last_updated) from GitHub API for a repository.
 * @param {string} repo - The GitHub repository identifier (e.g., "owner/repo").
 * @param {boolean} verbose - Enable verbose logging.
 * @returns {Promise<{created_at: string, last_updated: string}|null>} Commit dates or null if failed.
 */
async function fetchCommitDates(repo, verbose = false) {
  try {
    // Fetch commits from GitHub API (latest commits first)
    const response = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Logseq-Marketplace-Catalog'
      }
    })

    if (!response.ok) {
      if (verbose) console.log(`Failed to fetch commits for ${repo}: ${response.status}`)
      return null
    }

    const commits = await response.json()
    if (!commits || commits.length === 0) {
      if (verbose) console.log(`No commits found for ${repo}`)
      return null
    }

    const lastCommit = commits[0]
    const last_updated = lastCommit.commit.committer.date

    // Fetch the first commit (oldest) by fetching all commits and getting the last page
    // For efficiency, we can use the GitHub API to get commit count and fetch last page
    const firstCommitResponse = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1&sha=HEAD`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Logseq-Marketplace-Catalog'
      }
    })

    if (!firstCommitResponse.ok) {
      if (verbose) console.log(`Failed to fetch first commit for ${repo}: ${firstCommitResponse.status}`)
      // Use last_updated as created_at as fallback
      return { created_at: last_updated, last_updated }
    }

    // Get the Link header to find the last page
    const linkHeader = firstCommitResponse.headers.get('Link')
    let created_at = last_updated // Default to last_updated

    if (linkHeader) {
      // Parse the Link header to get the last page URL
      const lastPageMatch = linkHeader.match(/<([^>]+)>;\s*rel="last"/)
      if (lastPageMatch) {
        const lastPageUrl = lastPageMatch[1]
        const lastPageResponse = await fetch(lastPageUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Logseq-Marketplace-Catalog'
          }
        })

        if (lastPageResponse.ok) {
          const lastPageCommits = await lastPageResponse.json()
          if (lastPageCommits && lastPageCommits.length > 0) {
            const firstCommit = lastPageCommits[lastPageCommits.length - 1]
            created_at = firstCommit.commit.committer.date
          }
        }
      }
    } else {
      // If no Link header, there's only one page, so the last commit in the list is the first commit
      const allCommitsResponse = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=100`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Logseq-Marketplace-Catalog'
        }
      })

      if (allCommitsResponse.ok) {
        const allCommits = await allCommitsResponse.json()
        if (allCommits && allCommits.length > 0) {
          const firstCommit = allCommits[allCommits.length - 1]
          created_at = firstCommit.commit.committer.date
        }
      }
    }

    if (verbose) console.log(`Fetched commit dates for ${repo}: created=${created_at}, updated=${last_updated}`)
    return { created_at, last_updated }
  } catch (error) {
    if (verbose) console.log(`Error fetching commit dates for ${repo}:`, error.message)
    return null
  }
}
