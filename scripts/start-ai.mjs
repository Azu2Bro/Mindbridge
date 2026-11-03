import 'dotenv/config'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const portable = resolve('.data/ollama/ollama.exe')
const executable = process.platform === 'win32' && existsSync(portable) ? portable : 'ollama'
const ollamaUrl = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '')

async function isRunning() {
  try {
    const response = await fetch(`${ollamaUrl}/api/version`, { signal: AbortSignal.timeout(2000) })
    return response.ok
  } catch {
    return false
  }
}

if (await isRunning()) {
  console.log(`Using the Ollama service already running at ${ollamaUrl}`)
  // Keep this development task alive so concurrently does not stop the other
  // services when Ollama is managed by another process.
  const keepAlive = setInterval(() => {}, 2 ** 30)
  const stop = () => { clearInterval(keepAlive); process.exit(0) }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
} else {
const child = spawn(executable, ['serve'], {
  stdio: 'inherit', windowsHide: true,
  env: {
    ...process.env,
    OLLAMA_HOST: '127.0.0.1:11434',
    OLLAMA_MODELS: process.env.OLLAMA_MODELS || resolve('.data/ollama-models'),
    OLLAMA_NO_CLOUD: 'true',
  },
})
child.on('error', (error) => {
  console.error(`Cannot start local AI: ${error.message}. Install Ollama first; see README.md.`)
  process.exitCode = 1
})
child.on('exit', (code) => { process.exitCode = code || 0 })
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
}
