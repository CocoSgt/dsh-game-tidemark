#!/usr/bin/env node
/**
 * Take the store pictures from the packed game: store/cover.jpg and store/shot-*.jpg.
 * Run scripts/pack.mjs first. Uses one headless Chrome through the game's own tools/cdp.js.
 *
 *   node scripts/shots.cjs [--source <game folder>] [--lang en]
 */
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process')
const root = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback }
const source = path.resolve(opt('--source', process.env.TIDEMARK_SOURCE || '/Users/admin/Documents/Codex/writing/2026-11-12-steel-tide-tactics'))
const lang = opt('--lang', 'zh-CN')
const { launch, sleep } = require(path.join(source, 'tools/cdp.js'))
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.txt': 'text/plain' }

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'
  const file = path.join(root, 'game', rel)
  if (!file.startsWith(path.join(root, 'game')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})

const save = async (b, name) => {
  const png = path.join(root, 'store', `${name}.png`)
  await b.shot(png)
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', png, '--out', path.join(root, 'store', `${name}.jpg`)], { stdio: 'ignore' })
  fs.rmSync(png)
  console.log(`store/${name}.jpg`)
}

server.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${server.address().port}/index.html?lang=${lang}`
  const b = await launch({ width: 1600, height: 900 })
  try {
    await b.size(1600, 900, 1)
    await b.goto(url)
    await sleep(5000)
    await save(b, 'cover')
    await b.eval('__game.startGame()')
    await sleep(7000)
    await save(b, 'shot-1')
    await b.eval('(() => { const g = __game; while (g.Nav.stack.length) g.act("cancel"); g.act("menu"); })()')
    await sleep(1200)
    await save(b, 'shot-2')
    if (b.errors.length) console.warn('page errors:\n  ' + b.errors.slice(0, 5).join('\n  '))
    if (b.missing.length) console.warn('missing files:\n  ' + [...new Set(b.missing)].slice(0, 10).join('\n  '))
  } finally { await b.close(); server.close() }
})
