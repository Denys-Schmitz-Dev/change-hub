import ts from 'typescript'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, lstat, realpath } from 'node:fs/promises'
import { join, sep, extname } from 'node:path'
import { createHash } from 'node:crypto'

const exec = promisify(execFile)
const categories = ['api', 'routes', 'ui', 'state', 'data', 'dependencies']
const hash = value => createHash('sha256').update(value).digest('hex')
const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })
const excluded = /(^|\/)(node_modules|vendor|\.git|\.agents|\.codex|dist|build|storage|public|tests?|e2e|change-evidence|test-results|playwright-report)(\/|$)/i

export function analyzeScript(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  if (source.parseDiagnostics.length) throw new Error('Source could not be parsed')
  const entries = []
  const occurrences = new Map()
  const print = node => printer.printNode(ts.EmitHint.Unspecified, node, source)
  const add = (category, label, node) => {
    const identity = `${category}:${label}`
    const occurrence = occurrences.get(identity) ?? 0
    occurrences.set(identity, occurrence + 1)
    entries.push({ category, key: `${file}:${identity}:${occurrence}`, file, label,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      signature: print(node) })
  }
  const hasJSX = node => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true
    return ts.forEachChild(node, hasJSX) || false
  }
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name && /^[A-Z]/.test(node.name.getText(source)) && hasJSX(node)) {
      add('ui', `Component ${node.name.getText(source)}`, node)
    }
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) add('data', `Type ${node.name.text}`, node)
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      if (tag === 'Route') add('routes', 'React Route', node)
      if (node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && ['href', 'to', 'action'].includes(attribute.name.getText(source)))) {
        add('ui', `Navigation ${tag}`, node)
      }
    }
    if (ts.isObjectLiteralExpression(node) && node.properties.some(property => property.name?.getText(source) === 'path') && node.properties.some(property => ['element', 'component', 'Component', 'children', 'loader'].includes(property.name?.getText(source)))) {
      add('routes', 'Route configuration', node)
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source)
      const name = callee.split('.').at(-1)
      if (callee === 'fetch' || callee === 'axios' || /^axios\.(get|post|put|patch|delete|request)$/.test(callee)) add('api', `Request ${callee}`, node)
      if (['navigate', 'redirect'].includes(name) || ['window.location.assign', 'window.location.replace'].includes(callee)) add('ui', `Navigation ${callee}`, node)
      if (['useState', 'useReducer', 'createContext', 'createStore', 'configureStore', 'createSlice', 'defineStore', 'createSignal'].includes(name) || (name === 'create' && /(^|\/)(stores?|state)(\/|\.)/i.test(file))) {
        const declaration = ts.isVariableDeclaration(node.parent) ? node.parent : node
        add('state', `State ${ts.isVariableDeclaration(declaration) ? declaration.name.getText(source) : callee}`, declaration)
      }
      if (['createBrowserRouter', 'createHashRouter', 'createRouter'].includes(name)) add('routes', `Router ${callee}`, node)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return entries
}

export async function snapshotContracts(repository) {
  const root = await realpath(repository)
  const snapshot = { version: 1, capturedAt: new Date().toISOString(), categories: Object.fromEntries(categories.map(key => [key, []])), scannedFiles: 0, warnings: [] }
  try {
    const { stdout } = await exec('git', ['-c', `safe.directory=${root}`, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, maxBuffer: 16 * 1024 * 1024 })
    const files = [...new Set(stdout.split('\0').filter(Boolean))].sort()
    let total = 0
    for (const file of files) {
      if (excluded.test(file) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) continue
      const extension = extname(file)
      const manifest = ['package.json', 'composer.json'].includes(file.split('/').at(-1))
      if (!manifest && !['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.php'].includes(extension)) continue
      if (snapshot.scannedFiles >= 2000 || total >= 16 * 1024 * 1024) {
        snapshot.warnings.push('Source scan limit reached; coverage is partial.')
        break
      }
      try {
        const path = join(root, file)
        const stat = await lstat(path)
        if (!stat.isFile() || stat.isSymbolicLink() || !(await realpath(path)).startsWith(root + sep)) {
          snapshot.warnings.push(`Skipped non-regular source: ${file}`)
          continue
        }
        if (stat.size > 512 * 1024) {
          snapshot.warnings.push(`Skipped large source: ${file}`)
          continue
        }
        const text = await readFile(path, 'utf8')
        total += stat.size
        snapshot.scannedFiles++
        let entries = []
        if (manifest) {
          const json = JSON.parse(text)
          for (const group of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'require', 'require-dev']) {
            for (const [name, version] of Object.entries(json[group] ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
              entries.push({ category: 'dependencies', key: `${file}:${group}:${name}`, file, line: 1, label: `${name} (${group})`, signature: JSON.stringify(version) })
            }
          }
        } else if (extension === '.php') {
          const category = /(^|\/)routes\//i.test(file) ? 'routes'
            : /(^|\/)(Controllers|Requests|Resources)\//i.test(file) ? 'api'
            : /(^|\/)(Models|migrations)\//i.test(file) ? 'data' : null
          if (category) entries.push({ category, key: file, file, line: 1, label: `PHP source: ${file.split('/').at(-1)}`, signature: text.replaceAll('\r\n', '\n') })
        } else entries = analyzeScript(file, text)
        for (const { category, signature, ...entry } of entries) {
          snapshot.categories[category].push({ ...entry, signature: signature.slice(0, 12000), hash: hash(signature), truncated: signature.length > 12000 })
        }
      } catch (error) {
        // Deleted tracked files are absent from the new snapshot, not scan failures.
        if (error.code !== 'ENOENT') snapshot.warnings.push(`Could not scan ${file}: ${error.message}`)
      }
    }
  } catch (error) {
    snapshot.warnings.push(`Source scan failed: ${error.message}`)
  }
  return snapshot
}
