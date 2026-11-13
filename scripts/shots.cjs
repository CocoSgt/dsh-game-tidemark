#!/usr/bin/env node
/**
 * Take the store screenshots and clip from the packed game: store/shot-*.jpg and store/play.mp4.
 * The cover is drawn art (art/cover.png), not a capture; scripts/pack.mjs turns it into store/cover.jpg.
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

/** Record what the page shows for `ms` milliseconds, about 12 frames a second. */
let frames = 0
const frameDir = path.join(root, '.frames')
async function rec(b, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const t = Date.now()
    const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
    fs.writeFileSync(path.join(frameDir, `f${String(frames++).padStart(4, '0')}.jpg`), Buffer.from(r.data, 'base64'))
    const wait = 83 - (Date.now() - t)
    if (wait > 0) await sleep(wait)
  }
}

server.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${server.address().port}/index.html?lang=${lang}`
  // 1280×720 keeps the clip small; the cover is taken at 1600×900.
  const b = await launch({ width: 1600, height: 900 })
  fs.rmSync(frameDir, { recursive: true, force: true }); fs.mkdirSync(frameDir, { recursive: true })
  try {
    await b.size(1600, 900, 1)
    await b.goto(url)
    await sleep(5000)
    await b.size(1280, 720, 1)
    await b.eval('__game.startGame()')
    await sleep(7000)
    // One turn of play, the way a player does it: pick a unit, see where it can go, draw the path, confirm.
    const plan = JSON.parse(await b.eval(`(() => {
      const g = __game, S = g.S, mine = S.units.filter(u => u.owner === S.turn && !u.moved)
      const u = mine.find(u => /tnk|tank|recon/.test(u.type)) || mine[0]
      // Head for the middle of the map, measured from where both armies stand.
      const xs = S.units.map(v => v.x), ys = S.units.map(v => v.y)
      const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2
      return JSON.stringify({ x: u.x, y: u.y, dx: Math.sign(mx - u.x) || 1, dy: Math.sign(my - u.y), type: u.type })
    })()`))
    const act = async (name, ms) => { await b.eval(`__game.act(${JSON.stringify(name)})`); await rec(b, ms) }
    await rec(b, 900)
    for (let n = 0; n < 40; n++) {
      const [cx, cy] = JSON.parse(await b.eval('JSON.stringify([__game.cur.x, __game.cur.y])'))
      if (cx === plan.x && cy === plan.y) break
      await act(cx < plan.x ? 'right' : cx > plan.x ? 'left' : cy < plan.y ? 'down' : 'up', 130)
    }
    await act('ok', 900)
    for (const step of [plan.dx > 0 ? 'right' : 'left', plan.dx > 0 ? 'right' : 'left', plan.dy > 0 ? 'down' : plan.dy < 0 ? 'up' : (plan.dx > 0 ? 'right' : 'left')]) await act(step, 380)
    await rec(b, 500)
    await save(b, 'shot-1')
    await rec(b, 500)
    await act('ok', 1400)
    await save(b, 'shot-2')
    await act('ok', 2200)
    await b.eval('(() => { const g = __game; while (g.Nav.stack.length) g.act("cancel"); g.act("menu"); })()')
    await sleep(1000)
    await save(b, 'shot-3')
    if (b.errors.length) console.warn('page errors:\n  ' + b.errors.slice(0, 5).join('\n  '))
    if (b.missing.length) console.warn('missing files:\n  ' + [...new Set(b.missing)].slice(0, 10).join('\n  '))
  } finally { await b.close(); server.close() }
  // The clip: plays by itself like an animated picture on the game page.
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', path.join(frameDir, 'f%04d.jpg'), '-vf', 'scale=1280:720:flags=lanczos,fps=24', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(root, 'store/play.mp4')])
    fs.copyFileSync(path.join(root, 'store/shot-1.jpg'), path.join(root, 'store/play-poster.jpg'))
    console.log(`store/play.mp4  ${frames} frames, ${(fs.statSync(path.join(root, 'store/play.mp4')).size / 1024).toFixed(0)} KB`)
  } catch (e) { console.warn('ffmpeg did not run; no clip was made: ' + e.message) }
  fs.rmSync(frameDir, { recursive: true, force: true })
})
