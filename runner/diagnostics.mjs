import { createRequire } from 'node:module'
const { yauzl } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle')

export function traceDiagnostics(bytes) {
 return new Promise((resolve) => {
  const result = { console: [], network: [], warnings: [] }
  yauzl.fromBuffer(bytes, { lazyEntries: true }, (error, zip) => {
   if (error) return resolve({ ...result, warnings: ['Trace could not be read.'] })
   let total = 0, finished = false
   const finish = (warning) => {
    if (finished) return
    finished = true
    if (warning) result.warnings.push(warning)
    zip.close(); resolve(result)
   }
   zip.on('error', () => finish('Trace could not be read completely.'))
   zip.on('end', () => finish())
   zip.on('entry', entry => {
    if (!/\.(trace|network)$/.test(entry.fileName)) return zip.readEntry()
    total += entry.uncompressedSize
    if (total > 20 * 1024 * 1024) return finish('Trace diagnostics exceeded the size limit.')
    zip.openReadStream(entry, (error, stream) => {
     if (error) return finish('Trace entry could not be read.')
     const chunks = []
     stream.on('error', () => finish('Trace entry could not be read.'))
     stream.on('data', chunk => chunks.push(chunk))
     stream.on('end', () => {
      try {
       for (const line of Buffer.concat(chunks).toString().split('\n').filter(Boolean)) {
        const event = JSON.parse(line)
        if (event.type === 'console') result.console.push(`${event.messageType}: ${event.text ?? ''}`.slice(0, 4000))
        if (event.type === 'resource-snapshot') {
         const { request, response } = event.snapshot
         const url = new URL(request.url)
         result.network.push(`${request.method} ${url.origin}${url.pathname} → ${response.status}`)
        }
        if (result.console.length + result.network.length > 5000) return finish('Trace diagnostics exceeded the event limit.')
       }
      } catch { result.warnings.push('Some trace events could not be read.') }
      if (!finished) zip.readEntry()
     })
    })
   })
   zip.readEntry()
  })
 })
}
