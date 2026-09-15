// Rasterizes public/icon.svg into the PNG sizes that Android and iOS home screens expect.
// Uses headless Chrome, which every machine that can demo this project already has.
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const exists = async (path) => access(path).then(() => true).catch(() => false)
const chromePath = (await Promise.all(candidates.map(async (path) => (await exists(path)) ? path : null))).find(Boolean)

if (!chromePath) {
  console.warn('Chrome was not found, so PNG icons were skipped. The SVG icon still works in Chrome and Edge.')
  console.warn('Set CHROME_PATH to your browser binary and run "npm run icons" again.')
  process.exit(0)
}

const svg = await readFile(resolve('public/icon.svg'), 'utf8')
const targets = [
  { file: 'public/icon-192.png', size: 192, padding: 0 },
  { file: 'public/icon-512.png', size: 512, padding: 0 },
  // iOS crops to a rounded square and shows no transparency, so the artwork is inset slightly.
  { file: 'public/apple-touch-icon.png', size: 180, padding: 0 },
  // Maskable icons must survive an aggressive circular crop, so keep the mark inside the safe zone.
  { file: 'public/icon-maskable-512.png', size: 512, padding: 52 },
]

const workDirectory = await mkdtemp(join(tmpdir(), 'mentalbridge-icons-'))

for (const { file, size, padding } of targets) {
  const page = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent}
    body{width:${size}px;height:${size}px;display:grid;place-items:center;overflow:hidden}
    svg{width:${size - padding * 2}px;height:${size - padding * 2}px}
  </style>${svg}`
  const pagePath = join(workDirectory, `${size}-${padding}.html`)
  await writeFile(pagePath, page, 'utf8')
  const outputPath = resolve(file)
  await new Promise((done, fail) => {
    const chrome = spawn(chromePath, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=1', `--window-size=${size},${size}`,
      `--screenshot=${outputPath}`, `file://${pagePath.replaceAll('\\', '/')}`,
    ], { stdio: 'ignore', windowsHide: true })
    chrome.on('error', fail)
    chrome.on('exit', (code) => code === 0 ? done() : fail(new Error(`Chrome exited with code ${code} while rendering ${file}`)))
  })
  console.log(`Wrote ${file} (${size}x${size})`)
}

await rm(workDirectory, { recursive: true, force: true })
