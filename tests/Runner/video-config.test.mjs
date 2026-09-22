import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { withVideoConfig } from '../../runner/video-config.mjs'

test('video overrides preserve config location and are cleaned up on failure', async () => {
 const directory = await mkdtemp(join(tmpdir(), 'hub-video-'))
 try {
  await assert.rejects(withVideoConfig(join(directory, 'playwright.config.ts'), false, async wrapper => {
   assert.equal(dirname(wrapper), directory)
   const source = await readFile(wrapper, 'utf8')
   assert.match(source, /const video = "off"/)
   assert.match(source, /\.\.\.project\.use, video/)
   assert.doesNotMatch(source, /grep/)
   throw new Error('Runner failed')
  }), /Runner failed/)
  assert.deepEqual(await readdir(directory), [])
  await withVideoConfig(join(directory, 'playwright.config.ts'), true, async wrapper => {
   assert.match(await readFile(wrapper, 'utf8'), /const video = "on"/)
  })
  assert.deepEqual(await readdir(directory), [])
 } finally { await rm(directory, { recursive: true, force: true }) }
})
