import { writeFile, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

export async function withVideoConfig(config, enabled, run) {
 // Keep relative paths and project dependencies relative to the original config.
 const wrapper = join(dirname(config), `.change-hub-${randomUUID()}.config.ts`)
 const mode = enabled ? 'on' : 'off'
 const source = `import original from ${JSON.stringify(config)};
const video = ${JSON.stringify(mode)};
export default {
 ...original,
 use: { ...original.use, video },
 ...(original.projects ? { projects: original.projects.map(project => ({
  ...project, use: { ...project.use, video }
 })) } : {})
};
`
 await writeFile(wrapper, source, { flag: 'wx' })
 try { return await run(wrapper) }
 finally { await unlink(wrapper) }
}
