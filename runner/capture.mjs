import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { captureSession } from './engine.mjs'

const profile = JSON.parse(await readFile(process.argv[2], 'utf8'))
if (profile.version !== 1 || !isAbsolute(profile.output) || !isAbsolute(profile.repository)) throw new Error('Invalid capture request.')
const base = new URL(profile.baseURL)
if (!['http:', 'https:'].includes(base.protocol) || new URL(profile.path, base).origin !== base.origin) throw new Error('Invalid target URL.')
const choices = profile.adapter === 'resume' ? ['guest','pending','approved','denied','unavailable'] : ['live']
if (!profile.devices?.length || profile.devices.some(v => !['desktop','mobile'].includes(v)) || !profile.scenarios?.length || profile.scenarios.some(v => !choices.includes(v))) throw new Error('Invalid capture views.')
profile.allowedOrigins = [...new Set([base.origin, ...profile.allowedOrigins])]
const run = { status: 'running', frames: [], startedAt: new Date().toISOString(), profileVersion: 1 }
await mkdir(profile.output, { recursive: true })
async function save() {
  await writeFile(join(profile.output, 'result.tmp'), JSON.stringify(run, null, 2))
  await rename(join(profile.output, 'result.tmp'), join(profile.output, 'result.json'))
}
try {
  await captureSession({ session: profile, run, directory: profile.output, baseURL: base.origin, repoRoot: profile.repository, progress: save })
  run.status = 'complete'
} catch (error) { run.status = 'failed'; run.error = error.message; process.exitCode = 1 }
finally { run.completedAt = new Date().toISOString(); await save() }
