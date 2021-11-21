#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import https from 'https'

const ROOT = path.resolve('..')
const GITHUB_ENDPOINT = 'https://api.github.com/'
const PLUGINS_ALL_FILE = 'plugins.json'
const STATS_FILE = 'stats.json'
const ERRORS_FILE = 'errors.json'
const delay = (ms = 1000) => new Promise((r) => setTimeout(r, ms))

function httpGet (url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'request',
      },
    }, (res) => {
      if (res.statusCode != 200) {
        reject(`StatusCode: ${res.statusCode}`)
      }

      const chunks = []
      res.on('data', (chunk) => {
        chunks.push(chunk)
      })
      res.on('end', () => {
        try {
          const data = JSON.parse(chunks.join(''))
          resolve(data)
        } catch (e) {
          reject(new Error('Data parse error'))
        }
      })

    }).on('error', reject)
  })
}

function getRepoReleasesStat (repo) {
  const url = path.join(GITHUB_ENDPOINT, 'repos', repo, 'releases')
  console.log('Stat Repo:', url)
  return httpGet(url)
}

function getRepoBaseInfo (repo) {
  const url = path.join(GITHUB_ENDPOINT, 'repos', repo)
  console.log('Info Repo:', url)
  return httpGet(url)
}

async function cli (action, rest) {
  switch (action) {
    case '--stat': {
      console.log('===== Building Stats =====')

      const isFixErrors = rest?.includes('error')
      const packages = isFixErrors ?
        JSON.parse(fs.readFileSync(path.join(ROOT, ERRORS_FILE)).toString())
        : JSON.parse(fs.readFileSync(path.join(ROOT, PLUGINS_ALL_FILE)).
          toString()).packages

      const outStats = isFixErrors ? JSON.parse(fs.readFileSync(path.join(ROOT, STATS_FILE)).toString()) : {}
      const errors = []

      for (let pkg of packages) {
        const { id, repo } = pkg
        try {
          const base = await getRepoBaseInfo(repo)
          await delay(2000)
          const ref = outStats[id] = [
            'created_at',
            'updated_at',
            'stargazers_count',
            'open_issues_count',
            'disabled',
            'pushed_at'].reduce((ac, it) => {
            ac[it] = base[it]
            return ac
          }, {})

          const releases = await getRepoReleasesStat(repo)
          const refReleases = ref.releases = []

          releases?.forEach(stat => {
            if (!stat?.draft) {
              refReleases.push([
                stat.tag_name, // version
                stat.prerelease, // prerelease
                (stat.assets || []).reduce((acc, it) => {
                  return acc + (it.download_count || 0)
                }, 0), // total downloads
              ])
            }
          })
        } catch (e) {
          console.warn('Error Repo:', repo, ' [Error] ', e.message)
          errors.push({ ...pkg, error: e })
        }
      }

      const outFile = path.join(ROOT, STATS_FILE)
      const errFile = path.join(ROOT, ERRORS_FILE)

      fs.writeFileSync(outFile, JSON.stringify(outStats))
      fs.writeFileSync(errFile, JSON.stringify(errors, null, 2))
      break
    }

    case '--build':
    default: {
      // build plugins
      console.log('===== Building Plugins =====')
      console.log('')

      const pkgsRoot = path.join(ROOT, 'packages')
      let pkgs = fs.readdirSync(pkgsRoot)

      pkgs = pkgs.reduce((acc, it) => {

        if (!it?.startsWith('.')) {
          let st = fs.statSync(path.join(pkgsRoot, it))
          let mf = path.join(pkgsRoot, it, 'manifest.json')

          if (st.isDirectory() && fs.existsSync(mf)) {
            mf = JSON.parse(fs.readFileSync(mf).toString())
            mf.id = it.toLowerCase()
            acc.push(mf)
          }
        }

        return acc
      }, [])

      const outFile = path.join(ROOT, PLUGINS_ALL_FILE)
      const outData = {
        datetime: Date.now(),
        packages: pkgs,
      }

      fs.writeFileSync(outFile, JSON.stringify(outData, null, 2))
    }
  }
}

// entry
cli(...process.argv.slice(2)).catch(console.error)
