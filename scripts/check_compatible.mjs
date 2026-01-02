#!/usr/bin/env node
/* eslint-disable no-console */

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getRepoRoot () {
  return path.resolve(__dirname, '..')
}

function ensureDir (dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function readJson (filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

/**
 * repo can be "owner/name" or a full GitHub URL.
 * @param {string} repo
 * @returns {{owner: string, name: string} | null}
 */
export function parseGitHubRepo (repo) {
  if (!repo || typeof repo !== 'string') return null

  const cleaned = repo.trim().replace(/^git\+/, '').replace(
    /^https?:\/\/(www\.)?github\.com\//i, '').replace(/^github\.com\//i,
    '').replace(/\.git$/i, '').replace(/\/$/, '')

  const parts = cleaned.split('/').filter(Boolean)
  if (parts.length < 2) return null

  const owner = parts[0]
  const name = parts[1]
  if (!owner || !name) return null

  return { owner, name }
}

function pathExists (p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

function removeDirRecursive (dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true })
}

function listSubdirs (dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true }).filter(
    (d) => d.isDirectory()).map((d) => d.name)
}

function unzipToDir (zipPath, destDir) {
  ensureDir(destDir)
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', destDir],
    { stdio: 'inherit' })
}

function normalizeExtractedRootToPluginDir (extractDir) {
  // GitHub zip usually extracts as a single top-level folder. Flatten it.
  const subdirs = listSubdirs(extractDir)
  if (subdirs.length !== 1) return

  const rootCandidate = path.join(extractDir, subdirs[0])
  if (!pathExists(rootCandidate) ||
    !fs.statSync(rootCandidate).isDirectory()) return

  for (const entry of fs.readdirSync(rootCandidate)) {
    const from = path.join(rootCandidate, entry)
    const to = path.join(extractDir, entry)
    if (pathExists(to)) {
      fs.rmSync(to, { recursive: true, force: true })
    }
    fs.renameSync(from, to)
  }

  removeDirRecursive(rootCandidate)
}

function requestToFile (url, outFilePath) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'logseq-marketplace-script',
          Accept: 'application/vnd.github+json',
        },
      },
      (res) => {
        // follow redirects (GitHub uses 302 to codeload)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 &&
          res.headers.location) {
          res.resume()
          requestToFile(res.headers.location, outFilePath).then(resolve, reject)
          return
        }

        if (res.statusCode !== 200) {
          const chunks = []
          res.on('data', (d) => chunks.push(d))
          res.on('end', () => {
            reject(
              new Error(
                `HTTP ${res.statusCode} while downloading ${url}: ${Buffer.concat(
                  chunks).toString('utf8').slice(0, 500)}`,
              ),
            )
          })
          return
        }

        const fileStream = fs.createWriteStream(outFilePath)
        res.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close(() => resolve())
        })
        fileStream.on('error', (err) => {
          fileStream.close(() => reject(err))
        })
      },
    )

    req.on('error', reject)
  })
}

function buildZipUrl ({ owner, name }, branch) {
  return `https://github.com/${owner}/${name}/archive/refs/heads/${branch}.zip`
}

function outputZipPath (reposDir, { owner, name }, branch) {
  return path.join(reposDir, `${owner}__${name}__${branch}.zip`)
}

async function downloadRepoZip ({ owner, name, reposDir }) {
  const candidates = ['main', 'master']
  let lastErr = null

  for (const branch of candidates) {
    const url = buildZipUrl({ owner, name }, branch)
    const zipPath = outputZipPath(reposDir, { owner, name }, branch)

    try {
      await requestToFile(url, zipPath)
      return { zipPath, branch }
    } catch (e) {
      lastErr = e
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
      } catch {
        // ignore
      }
    }
  }

  throw lastErr || new Error(`Failed to download ${owner}/${name}`)
}

function parseArgs (argv) {
  const args = {
    input: null,
    outDir: null,
    limit: 2,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    const next = argv[i + 1]
    if ((a === '--input' || a === '-i') && next) {
      args.input = next
      i += 1
    } else if ((a === '--outDir' || a === '-o') && next) {
      args.outDir = next
      i += 1
    } else if ((a === '--limit' || a === '-n') && next) {
      args.limit = Number(next)
      i += 1
    } else if (a === '--help' || a === '-h') {
      args.help = true
    }
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) args.limit = 2
  return args
}

function printHelp () {
  const root = getRepoRoot()
  console.log(
    `Usage: node scripts/check_compatible.mjs [options]\n\nOptions:\n  -i, --input <path>    Input popular.json (default: ${path.join(
      root,
      'popular.json')})\n  -o, --outDir <path>   Directory to save zips (default: ${path.join(
      root,
      'scripts/.repos')})\n  -n, --limit <number>  Only download first N entries (default: 2)\n  -h, --help            Show help\n`,
  )
}

/**
 * Read popular.json merged list and download GitHub source zips.
 * @param {{ popularJsonPath: string, reposDir: string, limit: number }} params
 */
export async function downloadReposFromPopularJson ({
  popularJsonPath,
  reposDir,
  limit,
}) {
  const popular = readJson(popularJsonPath)
  const merged = Array.isArray(popular?.merged) ? popular.merged : []

  if (!merged.length) {
    throw new Error(`No merged list found in ${popularJsonPath}`)
  }

  ensureDir(reposDir)

  const results = []
  let handled = 0

  for (const item of merged) {
    if (handled >= limit) break

    const pluginId = item?.id
    if (!pluginId) {
      console.warn(
        `Skip item without id: ${JSON.stringify(item).slice(0, 200)}`)
      continue
    }

    // New rule: if entry has dbSupported field, just skip it (doesn't count toward limit).
    if (Object.prototype.hasOwnProperty.call(item, 'dbSupported')) {
      console.log(`Skip (dbSupported present): ${pluginId}`)
      continue
    }

    // This one counts toward limit.
    handled += 1

    const pluginDir = path.join(reposDir, pluginId)
    if (pathExists(pluginDir) && fs.statSync(pluginDir).isDirectory()) {
      console.log(
        `Skip (already extracted): ${pluginId} -> ${path.relative(getRepoRoot(),
          pluginDir)}`)
      results.push({
        id: pluginId,
        repo: item.repo,
        skipped: true,
        reason: 'already_extracted',
        dir: pluginDir,
      })
      continue
    }

    const parsed = parseGitHubRepo(item.repo)
    if (!parsed) {
      console.warn(`Skip invalid repo: ${item.repo} (id=${pluginId})`)
      results.push({
        id: pluginId,
        repo: item.repo,
        skipped: true,
        reason: 'invalid_repo',
      })
      continue
    }

    console.log(`Preparing ${pluginId}: ${parsed.owner}/${parsed.name}`)

    // Download (or reuse existing zip)
    const mainZip = outputZipPath(reposDir,
      { owner: parsed.owner, name: parsed.name }, 'main')
    const masterZip = outputZipPath(reposDir,
      { owner: parsed.owner, name: parsed.name }, 'master')

    /** @type {string | null} */
    let zipPath = null
    /** @type {string | null} */
    let branch = null

    if (pathExists(mainZip)) {
      zipPath = mainZip
      branch = 'main'
    } else if (pathExists(masterZip)) {
      zipPath = masterZip
      branch = 'master'
    } else {
      console.log(`Downloading ${parsed.owner}/${parsed.name} (id=${pluginId})`)
      const downloaded = await downloadRepoZip({
        owner: parsed.owner,
        name: parsed.name,
        reposDir,
      })
      zipPath = downloaded.zipPath
      branch = downloaded.branch
      const stat = fs.statSync(zipPath)
      console.log(
        `Saved ${stat.size} bytes -> ${path.relative(getRepoRoot(), zipPath)}`)
    }

    // Extract
    removeDirRecursive(pluginDir)
    console.log(`Extracting -> ${path.relative(getRepoRoot(), pluginDir)}`)
    unzipToDir(zipPath, pluginDir)
    normalizeExtractedRootToPluginDir(pluginDir)

    results.push({
      id: pluginId,
      repo: item.repo,
      owner: parsed.owner,
      name: parsed.name,
      branch,
      zipPath,
      dir: pluginDir,
      skipped: false,
    })
  }

  if (handled < limit) {
    console.warn(`Only handled ${handled}/${limit} items (after filters).`)
  }

  return results
}

async function main () {
  const opts = parseArgs(process.argv)
  if (opts.help) {
    printHelp()
    return
  }

  const root = getRepoRoot()
  const popularJsonPath = opts.input ? path.resolve(opts.input) : path.join(
    root, 'popular.json')
  const reposDir = opts.outDir ? path.resolve(opts.outDir) : path.join(root,
    'scripts/.repos')

  const results = await downloadReposFromPopularJson({
    popularJsonPath,
    reposDir,
    limit: opts.limit,
  })

  console.log(`Done. Handled ${results.length} item(s).`)
}

// Run as CLI if invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) ===
  path.resolve(__filename)) {
  main().catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}
