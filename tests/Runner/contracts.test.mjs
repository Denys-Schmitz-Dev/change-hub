import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { analyzeScript, snapshotContracts } from '../../runner/contracts.mjs'

test('extracts UI paths, API requests, routes, stores, and data declarations', () => {
  const result = analyzeScript('src/App.tsx', `
    interface User { id: number }
    const Session = createContext<User | null>(null);
    export function Home() { const [open, setOpen] = useState(false); return <a href="/login">Login</a>; }
    const routes = [{path: '/', element: <Home/>}];
    fetch('/api/user', { method: 'POST' });
  `)
  for (const category of ['api', 'routes', 'ui', 'state', 'data']) assert.ok(result.some(entry => entry.category === category), category)
  assert.ok(result.find(entry => entry.label === 'Navigation a').signature.includes('/login'))
  assert.ok(result.find(entry => entry.category === 'api').signature.includes('POST'))
})

test('snapshot preserves old contracts and detects edits, additions, deletions, and dependencies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contract-snapshot-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: root })
    await mkdir(join(root, 'src'))
    await mkdir(join(root, 'routes'))
    await writeFile(join(root, 'src/App.tsx'), `export function Home() { return <a href="/old">Home</a> }`)
    await writeFile(join(root, 'src/removed.ts'), 'export interface Removed { id: string }')
    await writeFile(join(root, 'routes/api.php'), "<?php Route::get('/users', [UserController::class, 'index']);")
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { react: '18' } }))
    execFileSync('git', ['add', '.'], { cwd: root })
    const before = await snapshotContracts(root)
    await writeFile(join(root, 'src/App.tsx'), `export function Home() { return <a href="/new">Home</a> }`)
    await writeFile(join(root, 'src/store.ts'), 'export const count = createStore({value: 0})')
    await rm(join(root, 'src/removed.ts'))
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { react: '19' } }))
    const after = await snapshotContracts(root)
    assert.deepEqual(after.warnings, [])
    const previous = before.categories.ui.find(entry => entry.label === 'Navigation a')
    const current = after.categories.ui.find(entry => entry.key === previous.key)
    assert.notEqual(current.hash, previous.hash)
    assert.ok(previous.signature.includes('/old'))
    assert.ok(current.signature.includes('/new'))
    assert.equal(before.categories.data.length, 1)
    assert.equal(after.categories.data.length, 0)
    assert.equal(after.categories.state.length, 1)
    assert.equal(after.categories.routes.length, 1)
    assert.notEqual(before.categories.dependencies[0].hash, after.categories.dependencies[0].hash)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('skips generated sources and symlinks and reports parsing failures as partial coverage', async () => {
  const root = await mkdtemp(join(tmpdir(), 'contract-coverage-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: root })
    await mkdir(join(root, 'tests'))
    await writeFile(join(root, 'tests/ignored.ts'), 'fetch("/ignored")')
    await writeFile(join(root, 'broken.ts'), 'export interface {')
    await symlink('/etc/passwd', join(root, 'outside.ts'))
    const result = await snapshotContracts(root)
    assert.equal(result.categories.api.length, 0)
    assert.ok(result.warnings.some(warning => warning.includes('broken.ts')))
    assert.ok(result.warnings.some(warning => warning.includes('outside.ts')))
  } finally { await rm(root, { recursive: true, force: true }) }
})
