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

// GitHub token for authenticated requests (increases rate limit from 60/hour to 5000/hour)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''


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
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Get GitHub API headers with authentication if token is available
 * @returns {Object} Headers object for fetch requests
 */
function getGitHubHeaders() {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Logseq-Marketplace-Catalog'
  }
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`
  }
  return headers
}

/**
 * Check GitHub API rate limit status
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Promise<{remaining: number, limit: number, reset: number}>}
 */
async function checkRateLimit(verbose = false) {
  try {
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: getGitHubHeaders()
    })
    if (response.ok) {
      const data = await response.json()
      const core = data.resources.core
      if (verbose) {
        console.log(`\nGitHub API Rate Limit: ${core.remaining}/${core.limit} remaining`)
        if (core.remaining < 100) {
          const resetDate = new Date(core.reset * 1000)
          console.log(`Warning: Low rate limit! Resets at ${resetDate.toLocaleString()}`)
        }
      }
      return core
    }
  } catch (error) {
    if (verbose) console.log('Failed to check rate limit:', error.message)
  }
  return { remaining: 0, limit: 60, reset: Date.now() / 1000 + 3600 }
}

/**
 * Fetch with retry and exponential backoff for rate limiting
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retries
 * @param {boolean} verbose - Enable verbose logging
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3, verbose = false) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)

      // Check rate limit from response headers
      const remaining = response.headers.get('X-RateLimit-Remaining')
      const limit = response.headers.get('X-RateLimit-Limit')

      if (remaining && parseInt(remaining) < 10) {
        console.log(`\n⚠️  Warning: Only ${remaining}/${limit} GitHub API requests remaining!`)
      }

      if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
        const resetTime = parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000
        const waitTime = Math.max(resetTime - Date.now(), 0)
        console.log(`\n❌ Rate limit exceeded. Reset at ${new Date(resetTime).toLocaleString()}`)
        console.log(`   Waiting ${Math.ceil(waitTime / 1000 / 60)} minutes...`)
        await delay(waitTime + 1000) // Wait until reset + 1 second
        continue
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60') * 1000
        console.log(`\n⏳ Rate limited (429). Waiting ${retryAfter / 1000} seconds...`)
        await delay(retryAfter)
        continue
      }

      return response
    } catch (error) {
      if (i === maxRetries - 1) throw error
      const waitTime = Math.pow(2, i) * 1000 // Exponential backoff
      if (verbose) console.log(`Retry ${i + 1}/${maxRetries} after ${waitTime}ms`)
      await delay(waitTime)
    }
  }
  throw new Error(`Failed after ${maxRetries} retries`)
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
    // Check if GitHub token is available
    if (GITHUB_TOKEN) {
      console.log('✓ GitHub token found - using authenticated requests (5000 req/hour)')
    } else {
      console.log('⚠️  No GitHub token found - using unauthenticated requests (60 req/hour)')
      console.log('   Set GITHUB_TOKEN or GH_TOKEN environment variable to increase limit')
    }

    // Check current rate limit status
    await checkRateLimit(verbose)

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

  // Reduce concurrency to avoid rate limiting
  const CONCURRENCY = GITHUB_TOKEN ? 5 : 2 // Lower concurrency for unauthenticated requests
  await Promise.all(Array(CONCURRENCY).fill().map(processPackages))

  // Check final rate limit status
  if (verbose) {
    console.log('\n')
    await checkRateLimit(verbose)
  }

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
      packageData.id = pkg.name
      packageData.repoUrl = `https://github.com/${manifest.repo}`
      packageData.defaultBranch = 'main' // Default to 'main', could also try 'master'
      packageData.readmeUrl = `https://github.com/${manifest.repo}#readme`

      // Build icon URL from GitHub repo
      if (manifest.icon) {
        packageData.iconUrl = `https://raw.githubusercontent.com/logseq/marketplace/master/packages/${pkg.name}/${manifest.icon?.replace(
          '[\.\/]', '')}`
      }

      // Fetch release dates from GitHub API (falls back to repo dates if no releases)
      const dates = await fetchCommitDates(manifest.repo, verbose)
      if (verbose) console.log(`==> dates for ${pkg.name}`, dates)
      await delay(100) // Small delay to avoid hitting rate limits

      if (dates) {
        packageData.created_at = dates.created_at
        packageData.last_updated = dates.last_updated
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

async function fetchCommitDates (repo, verbose = false) {
  try {
    // First try to fetch releases (much faster)
    const releasesResponse = await fetchWithRetry(
      `https://api.github.com/repos/${repo}/releases?per_page=100`,
      { headers: getGitHubHeaders() },
      3,
      verbose
    )

    if (releasesResponse.ok) {
      const releases = await releasesResponse.json()
      if (releases && releases.length > 0) {
        // Get the latest release (first in the list)
        const latestRelease = releases[0]
        const last_updated = latestRelease.published_at ||
          latestRelease.created_at

        // Get the oldest release (last in the list)
        const oldestRelease = releases[releases.length - 1]
        const created_at = oldestRelease.published_at ||
          oldestRelease.created_at

        if (verbose) console.log(
          `Fetched release dates for ${repo}: created=${created_at}, updated=${last_updated}`)
        return { created_at, last_updated }
      }
    }

    if (verbose) console.log(
      `No releases found for ${repo}, falling back to repository info`)

    // If no releases, fall back to repository created_at and updated_at
    const repoResponse = await fetchWithRetry(
      `https://api.github.com/repos/${repo}`,
      { headers: getGitHubHeaders() },
      3,
      verbose
    )

    if (!repoResponse.ok) {
      if (verbose) console.log(
        `Failed to fetch repo info for ${repo}: ${repoResponse.status}`)
      return null
    }

    const repoInfo = await repoResponse.json()
    const created_at = repoInfo.created_at
    const last_updated = repoInfo.updated_at || repoInfo.pushed_at

    if (verbose) console.log(
      `Fetched repo dates for ${repo}: created=${created_at}, updated=${last_updated}`)
    return { created_at, last_updated }
  } catch (error) {
    if (verbose) console.log(`Error fetching dates for ${repo}:`, error.message)
    return null
  }
}
