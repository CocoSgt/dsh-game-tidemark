#!/usr/bin/env node
/**
 * Build the Tidemark game package from the game's working folder.
 *
 *   node scripts/pack.mjs [--source <game folder>] [--no-manual] [--tarball]
 *
 * The source folder is only read. Everything is copied into this repo:
 *   game/    the files the game needs to run
 *   manual/  the handbook (one HTML file)
 * Safe to run again at any time: both folders are rebuilt from scratch.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = name => args.includes(name)
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback }
const source = resolve(opt('--source', process.env.TIDEMARK_SOURCE ?? '/Users/admin/Documents/Codex/writing/2026-11-12-steel-tide-tactics'))

/** Folders the running game loads files from. Everything else in the source folder stays behind. */
const KNOWN_DIRS = ['maps', 'i18n', 'fonts', 'cg', 'ui-assets', 'mods']
/** Parts of those folders that are working material, not loaded by the game. */
const SKIP = [/(^|\/)src(\/|$)/, /(^|\/)\.DS_Store$/, /\.(bak|psd|map|sh|md)$/i, /\.bak\.[a-z]+$/i, /(^|\/)old(\/|$)/]
const ROOT_FILES = /^(index\.html|favicon\.png|apple-touch-icon\.png|[\w-]+\.js)$/

if (!existsSync(join(source, 'index.html'))) { console.error(`No index.html in ${source}`); process.exit(1) }
// The game is still growing: also take any folder index.html loads a file from.
const named = [...readFileSync(join(source, 'index.html'), 'utf8').matchAll(/<(?:script|link)[^>]+(?:src|href)="([^":]+)\/[^"]*"/g)].map(m => decodeURI(m[1]).split('/')[0])
const RUNTIME_DIRS = [...new Set([...KNOWN_DIRS, ...named])].filter(d => KNOWN_DIRS.includes(d) ? true : existsSync(join(source, d)))

/** Documents the game itself points players at. */
const KEEP = ['mods/README.md']
const keep = rel => KEEP.includes(rel) || !SKIP.some(re => re.test(rel))
function copyTree(from, to, rel = '') {
  let n = 0, bytes = 0
  for (const name of readdirSync(join(from, rel))) {
    const r = rel ? `${rel}/${name}` : name
    if (!keep(r)) continue
    const st = statSync(join(from, r))
    if (st.isDirectory()) { const c = copyTree(from, to, r); n += c.n; bytes += c.bytes; continue }
    mkdirSync(dirname(join(to, r)), { recursive: true })
    cpSync(join(from, r), join(to, r))
    n++; bytes += st.size
  }
  return { n, bytes }
}

// --- game/
const gameDir = join(root, 'game')
rmSync(gameDir, { recursive: true, force: true })
mkdirSync(gameDir, { recursive: true })
let files = 0, bytes = 0
for (const name of readdirSync(source)) {
  const st = statSync(join(source, name))
  if (st.isFile() && ROOT_FILES.test(name)) { cpSync(join(source, name), join(gameDir, name)); files++; bytes += st.size }
}
for (const d of RUNTIME_DIRS) {
  if (!existsSync(join(source, d))) { if (d !== 'mods') console.warn(`warning: ${d}/ is missing in the source folder`); continue }
  mkdirSync(join(gameDir, d), { recursive: true })
  for (const name of readdirSync(join(source, d))) {
    const r = `${d}/${name}`
    if (!keep(r)) continue
    const st = statSync(join(source, r))
    if (st.isDirectory()) { const c = copyTree(source, gameDir, r); files += c.n; bytes += c.bytes } else { cpSync(join(source, r), join(gameDir, r)); files++; bytes += st.size }
  }
}

// Every script and stylesheet index.html names must be in the package.
const html = readFileSync(join(gameDir, 'index.html'), 'utf8')
const missing = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(p => !/^(https?:|data:)/.test(p) && !existsSync(join(gameDir, decodeURI(p))))
// index.html also loads a few scripts a moment after the first frame.
for (const m of html.matchAll(/\[((?:"[\w.-]+\.js",?\s*)+)\]/g)) for (const f of m[1].matchAll(/"([\w.-]+\.js)"/g)) if (!existsSync(join(gameDir, f[1]))) missing.push(f[1])
if (missing.length) { console.error(`index.html names files that were not copied:\n  ${missing.join('\n  ')}`); process.exit(1) }
// The store icon is the game's own app icon (the one index.html names as apple-touch-icon).
const appIcon = join(source, 'apple-touch-icon.png')
if (existsSync(appIcon)) { mkdirSync(join(root, 'store'), { recursive: true }); cpSync(appIcon, join(root, 'store/icon.png')) }
console.log(`game/    ${files} files, ${(bytes / 1048576).toFixed(1)} MB`)

// --- manual/
const manualDir = join(root, 'manual')
rmSync(manualDir, { recursive: true, force: true })
const manifest = JSON.parse(readFileSync(join(root, 'game.json'), 'utf8'))
if (flag('--no-manual')) {
  delete manifest.manual
  console.log('manual/  skipped (--no-manual)')
} else {
  const dir = join(source, 'handbook')
  const pages = existsSync(dir) ? readdirSync(dir).filter(f => /\.html$/i.test(f)) : []
  // The handbook has been renamed more than once: take the page changed most recently.
  const page = pages.map(f => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0]?.f
  if (!page) { console.error(`No handbook HTML in ${dir}. Use --no-manual to build without it.`); process.exit(1) }
  mkdirSync(manualDir, { recursive: true })
  cpSync(join(dir, page), join(manualDir, 'index.html'))
  manifest.manual = { zh: 'manual/index.html' }
  const text = readFileSync(join(manualDir, 'index.html'), 'utf8')
  const outside = [...text.matchAll(/(?:src|href)="(?!data:|#|https?:|mailto:)([^"]+)"/g)].map(m => m[1])
  if (outside.length) console.warn(`warning: the handbook points at ${outside.length} files beside it (${outside.slice(0, 3).join(', ')}…); they are not in the package`)
  console.log(`manual/  ${page} → index.html, ${(statSync(join(manualDir, 'index.html')).size / 1048576).toFixed(1)} MB`)
}
writeFileSync(join(root, 'game.json'), `${JSON.stringify(manifest, null, 2)}\n`)

// The game's own version number (mods.js, AWMods.GAME_VERSION) is what extensions are matched against:
// the package version must start with it.
const gv = /GAME_VERSION\s*=\s*'([\d.]+)'/.exec(existsSync(join(gameDir, 'mods.js')) ? readFileSync(join(gameDir, 'mods.js'), 'utf8') : '')?.[1]
const pv = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
if (gv && !pv.startsWith(`${gv}.`)) { console.error(`error: the game says version ${gv} but package.json says ${pv}. Set package.json to ${gv}.0 (or ${gv}.<n>).`); process.exit(1) }

// --- check against the store's rules, when the store repo sits beside this one
const spec = resolve(root, '../dsh-game-store/lib/spec.mjs')
if (existsSync(spec)) {
  const { checkPackage } = await import(spec)
  const r = checkPackage(root)
  for (const w of r.warnings) console.warn(`warning: ${w}`)
  for (const e of r.errors) console.error(`error: ${e}`)
  if (!r.ok) process.exit(1)
  console.log('check    passes the game store spec')
}

if (flag('--tarball')) {
  const out = execFileSync('npm', ['pack', '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const info = JSON.parse(out)[0]
  console.log(`tarball  ${info.filename}, ${(info.size / 1048576).toFixed(1)} MB packed, ${(info.unpackedSize / 1048576).toFixed(1)} MB unpacked, ${info.entryCount} files`)
  console.log(`         integrity ${info.integrity}`)
}
