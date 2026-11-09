import { spawn } from 'node:child_process'

const children = new Set()
let stopping = false

function start(command, args, env = process.env) {
  const child = spawn(command, args, { env, stdio: 'inherit' })
  children.add(child)
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (!stopping && command === process.execPath) {
      stopping = true
      for (const running of children) running.kill('SIGTERM')
      process.exitCode = code ?? (signal ? 1 : 0)
    }
  })
  child.on('error', (error) => {
    console.error(`Unable to start ${command}:`, error.message)
    if (command === process.execPath) process.exitCode = 1
  })
  return child
}

start('/opt/llama/llama-server', [
  '--model', process.env.LLAMACPP_MODEL || '/app/models/smollm2-135m-instruct-q3_k_m.gguf',
  '--host', '127.0.0.1',
  '--port', '8080',
  '--ctx-size', '2048',
  '--parallel', '1',
  '--threads', process.env.LLAMACPP_THREADS || '2',
])

async function waitForAi() {
  const healthUrl = 'http://127.0.0.1:8080/health'
  for (let attempt = 0; attempt < 360 && !stopping; attempt++) {
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1000) })
      if (response.ok) {
        console.log('Embedded AI is ready')
        return true
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

if (!await waitForAi()) console.warn('Embedded AI did not become ready after 3 minutes; the API will use its local safety fallback.')
if (!stopping) start(process.execPath, ['server/index.js'])

function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
