/**
 * AegisFlow Autosync
 * Watches the project for file changes and automatically commits + pushes
 * to GitHub a few seconds after you save, so you never lose work.
 *
 * Run with: npm run autosync
 * Stop with: Ctrl + C
 */

import chokidar from 'chokidar'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const DEBOUNCE_MS = 4000 // wait 4s after the last save before committing
const BRANCH = 'main'

let pending = false
let timer = null

const WATCH_PATHS = ['src', 'index.html', 'vite.config.js', 'package.json']
const IGNORED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/*.log',
]

function timestamp() {
  return new Date().toLocaleTimeString('en-KE', { hour12: false })
}

async function syncNow() {
  if (pending) return
  pending = true

  try {
    const { stdout: status } = await execAsync('git status --porcelain')
    if (!status.trim()) {
      pending = false
      return
    }

    console.log(`[${timestamp()}] Changes detected — committing...`)
    await execAsync('git add -A')

    const msg = `Autosync: ${new Date().toLocaleString('en-KE')}`
    await execAsync(`git commit -m "${msg}"`)

    console.log(`[${timestamp()}] Pushing to GitHub...`)
    await execAsync(`git push origin ${BRANCH}`)

    console.log(`[${timestamp()}] ✓ Synced to GitHub`)
  } catch (err) {
    // Common benign case: nothing to commit
    if (err.message.includes('nothing to commit')) {
      // no-op
    } else {
      console.error(`[${timestamp()}] ✗ Sync failed:`, err.message.split('\n')[0])
    }
  } finally {
    pending = false
  }
}

function scheduleSync() {
  clearTimeout(timer)
  timer = setTimeout(syncNow, DEBOUNCE_MS)
}

console.log('AegisFlow Autosync started.')
console.log(`Watching: ${WATCH_PATHS.join(', ')}`)
console.log(`Debounce: ${DEBOUNCE_MS / 1000}s after last save`)
console.log('Press Ctrl+C to stop.\n')

const watcher = chokidar.watch(WATCH_PATHS, {
  ignored: IGNORED,
  ignoreInitial: true,
  persistent: true,
})

watcher
  .on('add', (path) => { console.log(`[${timestamp()}] + ${path}`); scheduleSync() })
  .on('change', (path) => { console.log(`[${timestamp()}] ~ ${path}`); scheduleSync() })
  .on('unlink', (path) => { console.log(`[${timestamp()}] - ${path}`); scheduleSync() })
  .on('error', (err) => console.error('Watcher error:', err))