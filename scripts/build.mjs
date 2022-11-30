#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import https from 'https'
import HttpsProxyAgent from 'https-proxy-agent'
import cp from 'child_process'
import dayjs from 'dayjs'
import dayjsRelativeTime from 'dayjs/plugin/relativeTime.js'

dayjs.extend(dayjsRelativeTime)

const ROOT = path.resolve('..')
const GITHUB_ENDPOINT = 'https://api.github.com/'
const PLUGINS_ALL_FILE = 'plugins.json'
const STATS_FILE = 'stats.json'
const ERRORS_FILE = 'errors.json'
const delay = (ms = 1000) => new Promise((r) => setTimeout(r, ms))
const proxy = process.env.https_proxy || 'http://127.0.0.1:7890'
const agent = new HttpsProxyAgent(proxy)

let proxyEnabled = false

if (process.env.LSP_MK_TOKEN) {
  console.debug(`HTTP: token ${process.env.LSP_MK_TOKEN.substr(0, 8)}`)
}

function httpGet (url) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
    }

    if (process.env.LSP_MK_TOKEN) {
      headers.Authorization = `token ${process.env.LSP_MK_TOKEN}`
    }

    https.get(url, {
      headers, agent: proxyEnabled ? agent : false,
    }, (res) => {
      if (res.statusCode !== 200) {
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

function dateAdded (file) {
  const output = cp.execSync(
    `git log --follow --format=%ad --date default ${file} | tail -1`).toString()
  const date = new Date(output)

  return date.getTime()
}

function readCurrentPackages (unique = true) {
  const outFile = path.join(ROOT, PLUGINS_ALL_FILE)
  let pkgs = JSON.parse(fs.readFileSync(outFile).toString()).packages

  if (!unique) return pkgs

  return pkgs.reduce((a, b) => {
    a[b.id] = b
    return a
  }, {})
}

function getRepoReleasesStat (repo) {
  const url = GITHUB_ENDPOINT + path.join('repos', repo, 'releases')
  console.log('Stat Repo:', url)
  return httpGet(url)
}

function getRepoBaseInfo (repo) {
  const url = GITHUB_ENDPOINT + path.join('repos', repo)
  console.log('Info Repo:', url)
  return httpGet(url)
}

async function cli (action, ...rest) {
  switch (action) {
    case '--stat': {
      console.log('===== Building Stats =====')

      proxyEnabled = rest?.join(' ').includes('--proxy')
      const isFixErrors = rest?.join(' ').includes('--error')
      const isWorkByErrorPkg = rest?.join(' ').includes('--10x')

      let lastStats = JSON.parse(fs.readFileSync(path.join(ROOT, STATS_FILE)).toString())
      let errorPackages = JSON.parse(fs.readFileSync(path.join(ROOT, ERRORS_FILE)).toString())
      let packages = isFixErrors ? errorPackages
        : JSON.parse(fs.readFileSync(path.join(ROOT, PLUGINS_ALL_FILE)).toString()).packages

      /**
       * @param packages
       * @param refStats
       * @param refErrors
       * @returns {Promise<(any|*[])[]>}
       */
      async function batchWorker (packages, refStats, refErrors) {
        const outStats = (!refStats || isFixErrors) ? JSON.parse(
          fs.readFileSync(path.join(ROOT, STATS_FILE)).toString()) : (refStats || {})
        const outErrors = refErrors || []

        for (let pkg of packages) {
          const { id, repo, _payload, _releases } = pkg

          try {
            const lastPkgStat = lastStats?.[id]

            // skip fetch for fetedAt < 1000 * 60 * 60 // 1 hour
            if (lastPkgStat && lastPkgStat.lastFetchedAt) {
              if (Date.now() - lastPkgStat.lastFetchedAt < 1000 * 60 * 60) {
                console.debug('Job: skip #', id)
                outStats[id] = lastPkgStat
                continue
              }
            }

            const base = _payload || await getRepoBaseInfo(repo)

            await delay(300)

            const ref = outStats[id] = [
              'created_at',
              'updated_at',
              'stargazers_count',
              'open_issues_count',
              'disabled',
              'pushed_at'].reduce((ac, it) => {
              ac[it] = base[it]
              return ac
            }, {
              lastFetchedAt: Date.now()
            })

            // sometime break silently for network hang up
            const releases = _releases || await getRepoReleasesStat(repo)
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
            console.warn('Error Repo:', repo, ' [Error] ', e)
            outErrors.push({ ...pkg, error: e })
          }
        }

        const outFile = path.join(ROOT, STATS_FILE)
        const errFile = path.join(ROOT, ERRORS_FILE)

        fs.writeFileSync(outFile, JSON.stringify(outStats))
        fs.writeFileSync(errFile, JSON.stringify(outErrors, null, 2))

        return [outStats, outErrors]
      }

      // partition packages
      const perPageJobs = 10
      let jobs = null
      let refStats = null
      let refErrors = []

      if (!isFixErrors && errorPackages?.length && isWorkByErrorPkg) {
        const workErrorPkg = errorPackages.find(it => it?.error === 'StatusCode: 403')
        if (workErrorPkg) {
          const startPkgOffset = packages.findIndex(it => {
            return it.id === workErrorPkg.id
          })

          startPkgOffset && (packages = packages.slice(startPkgOffset))
        }
      }

      console.debug('Jobs: start from #', packages[0]?.id, ' total: ', packages?.length)

      while (jobs = packages.splice(0, perPageJobs)) {
        if (!jobs.length) break

        console.debug(`Jobs: [${packages.length}th] #${jobs.map(it => it.id).join(' #')}`);
        [refStats, refErrors] = await batchWorker(jobs, refStats, refErrors)

        await delay(500)

        if (refErrors.length && refErrors[refErrors.length - 1]?.error === 'StatusCode: 403') {
          throw new Error(`Fatal Error: ${refErrors.pop().error}`)
        }
      }

      break
    }

    case '--added': {
      const input = rest[0]
      const shouldWrite = rest[1] === 'write'
      let dayOffsetOrDate = Number(input)
      let date

      if (Number.isNaN(dayOffsetOrDate)) {
        date = dayjs(input)
        if (!date.isValid()) {
          throw new Error(`Date not valid #${input}`)
        }
      } else {
        date = dayjs().subtract(Math.abs(dayOffsetOrDate), 'day')
      }

      console.log()
      console.log(dayjs().from(date), ' [', date.toDate().toString(), ']')

      const startTime = date.toDate().getTime()
      const pkgs = readCurrentPackages(false)
      const output = {
        start: date.toDate().toString(),
        themes: [],
        plugins: [],
      }

      pkgs.forEach((it) => {
        if (!it.addedAt) return
        if (it.addedAt >= startTime) {
          output[it.theme ? 'themes' : 'plugins'].push(it)
        }
      })

      console.log('-'.repeat(60))
      console.log(`themes: +${output.themes.length} | plugins: +${output.plugins.length}`)
      console.log('-'.repeat(60))
      console.log(output)
      break
    }

    case '--build':
    default: {
      // build plugins
      console.log('===== Building Plugins =====')
      console.log('')

      const outFile = path.join(ROOT, PLUGINS_ALL_FILE)
      let oldPkgs = readCurrentPackages()

      const pkgsRoot = path.join(ROOT, 'packages')
      let pkgs = fs.readdirSync(pkgsRoot)

      pkgs = pkgs.reduce((acc, it) => {

        if (!it?.startsWith('.')) {
          let st = fs.statSync(path.join(pkgsRoot, it))
          let mfp = path.join(pkgsRoot, it, 'manifest.json')

          if (st.isDirectory() && fs.existsSync(mfp)) {
            const mf = JSON.parse(fs.readFileSync(mfp).toString())
            mf.id = it.toLowerCase()
            mf.addedAt = oldPkgs[mf.id]?.addedAt
            if (!mf.addedAt) {
              mf.addedAt = dateAdded(mfp)
            }
            acc.push(mf)
          }
        }

        return acc
      }, [])

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
