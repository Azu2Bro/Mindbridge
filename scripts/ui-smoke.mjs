import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
let appUrl = process.argv[2] || process.env.APP_URL || ''
if (!appUrl) {
  for (let port = 5173; port <= 5179; port += 1) {
    try {
      const source = await (await fetch(`http://127.0.0.1:${port}/src/LandingPage.jsx`)).text()
      if (source.includes('A gentler way to find someone')) { appUrl = `http://127.0.0.1:${port}`; break }
    } catch { /* Try the next local Vite port. */ }
  }
}
if (!appUrl) throw new Error('MentalBridge is not running. Start it with “npm run dev” first.')
const debugPort = 9300 + Math.floor(Math.random() * 500)
const profileDirectory = await mkdtemp(join(tmpdir(), 'mentalbridge-chrome-'))
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox', '--hide-scrollbars', `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDirectory}`, '--window-size=1440,1000', appUrl,
], { stdio: 'ignore', windowsHide: true })

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
let socket
let commandId = 0
const pending = new Map()

async function retry(operation, timeout = 15000) {
  const started = Date.now()
  let lastError
  while (Date.now() - started < timeout) {
    try { return await operation() } catch (error) { lastError = error; await delay(120) }
  }
  throw lastError || new Error('Timed out')
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++commandId
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression, awaitPromise = false) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed')
  return result.result?.value
}

async function waitForText(text) {
  await retry(async () => assert.equal(await evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), true))
}

async function clickButton(label) {
  const clicked = await evaluate(`(() => { const element = [...document.querySelectorAll('button')].find((button) => button.textContent.trim().includes(${JSON.stringify(label)})); if (!element) return false; element.click(); return true })()`)
  assert.equal(clicked, true, `Expected button containing “${label}”`)
}

async function clickAriaLabel(label) {
  const clicked = await evaluate(`(() => { const element = document.querySelector('button[aria-label="${label}"]'); if (!element) return false; element.click(); return true })()`)
  assert.equal(clicked, true, `Expected button labelled “${label}”`)
}

async function clickAdminTab(label) {
  const clicked = await evaluate(`(() => { const element = [...document.querySelectorAll('.admin-tabs button')].find((button) => button.textContent.trim().startsWith(${JSON.stringify(label)})); if (!element) return false; element.click(); return true })()`)
  assert.equal(clicked, true, `Expected administration tab “${label}”`)
}

try {
  const tabs = await retry(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
    const items = await response.json()
    const applicationTab = items.find((item) => item.url?.startsWith(appUrl))
    if (!applicationTab?.webSocketDebuggerUrl) throw new Error('MentalBridge page is not ready')
    return applicationTab
  })
  socket = new WebSocket(tabs.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const item = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result)
  })
  await send('Runtime.enable')
  await send('Page.enable')
  await waitForText('A gentler way to find someone')
  await waitForText('Call 999')
  await waitForText('Login')
  await waitForText('tafhimul456@gmail.com')
  assert.equal(await evaluate(`document.querySelector('.landing-footer a[href="mailto:tafhimul456@gmail.com"]') !== null`), true)
  const landingScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(join(process.cwd(), 'mentalbridge-landing.png'), Buffer.from(landingScreenshot.data, 'base64'))
  const initialTheme = await evaluate(`document.documentElement.dataset.theme`)
  assert.equal(await evaluate(`(() => { const button = document.querySelector('.theme-toggle'); if (!button) return false; button.click(); return true })()`), true)
  assert.notEqual(await evaluate(`document.documentElement.dataset.theme`), initialTheme)
  assert.equal(await evaluate(`(() => { const button = document.querySelector('.theme-toggle'); if (!button) return false; button.click(); return true })()`), true)
  await clickButton('Login')
  await waitForText('Welcome back')
  await clickButton('Create an account')
  await waitForText('Bengali and English names are supported')
  const signupFields = await evaluate(`(() => {
    const alias = document.querySelector('input[placeholder="QuietRiver"]')
    const name = document.querySelector('input[placeholder="Your private name"]')
    return { aliasMin: alias?.minLength, aliasMax: alias?.maxLength, nameMin: name?.minLength, nameMax: name?.maxLength }
  })()`)
  assert.deepEqual(signupFields, { aliasMin: 3, aliasMax: 40, nameMin: 2, nameMax: 70 })
  await clickAriaLabel('Close sign in')

  // Staff sign-in lives on its own page now, not as a tab inside the member dialog.
  assert.equal(await evaluate(`document.querySelector('.landing-nav .landing-staff-login')?.getAttribute('href')`), '/staff')
  await send('Page.navigate', { url: `${appUrl}/staff` })
  await waitForText('Care operations console')
  await waitForText('Sign in as staff')
  assert.equal(await evaluate(`document.querySelector('.portal-tabs') === null`), true)
  const staffRejectsMember = await evaluate(`(async () => { const response = await fetch('/api/auth/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'alex@mentalbridge.demo', password: 'Demo123!' }) }); return response.status })()`, true)
  assert.equal(staffRejectsMember, 403)
  const memberRejectsStaff = await evaluate(`(async () => { const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@mentalbridge.demo', password: 'Demo123!' }) }); const data = await response.json(); return { status: response.status, staffPortal: data.staffPortal } })()`, true)
  assert.deepEqual(memberRejectsStaff, { status: 403, staffPortal: true })
  await send('Page.navigate', { url: appUrl })
  await waitForText('A gentler way to find someone')

  const loggedIn = await evaluate(`(async () => { const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'alex@mentalbridge.demo', password: 'Demo123!' }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); localStorage.setItem('mentalbridge-token', data.token); return data.user.role })()`, true)
  assert.equal(loggedIn, 'user')
  await send('Page.reload', { ignoreCache: true })
  await waitForText('Good morning')

  const typeScale = await evaluate(`(() => ({ nav: parseFloat(getComputedStyle(document.querySelector('.nav-item')).fontSize), body: parseFloat(getComputedStyle(document.querySelector('.hero-copy > p')).fontSize), button: parseFloat(getComputedStyle(document.querySelector('.button')).fontSize) }))()`)
  assert.ok(typeScale.nav >= 15)
  assert.ok(typeScale.body >= 14)
  assert.ok(typeScale.button >= 13)

  const countState = await retry(async () => {
    const state = await evaluate(`(async () => {
      const token = localStorage.getItem('mentalbridge-token')
      const headers = { Authorization: 'Bearer ' + token }
      const [supportResponse, conversationResponse] = await Promise.all([
        fetch('/api/support-requests', { headers }),
        fetch('/api/conversations', { headers }),
      ])
      const supportData = await supportResponse.json()
      const conversationData = await conversationResponse.json()
      const badgeFor = (label) => {
        const button = [...document.querySelectorAll('.main-nav .nav-item')].find((item) => item.textContent.includes(label))
        return Number(button?.querySelector('em')?.textContent || 0)
      }
      return {
        expectedSupport: supportData.requests.filter((request) => !['completed', 'declined'].includes(request.status)).length,
        expectedMessages: conversationData.conversations.reduce((total, conversation) => total + (conversation.unread || 0), 0),
        renderedSupport: badgeFor('Peer support'),
        renderedMessages: badgeFor('Messages'),
      }
    })()`, true)
    assert.equal(state.renderedSupport, state.expectedSupport)
    assert.equal(state.renderedMessages, state.expectedMessages)
    return state
  })
  assert.ok(countState.expectedSupport >= 0)
  assert.ok(countState.expectedMessages >= 0)

  assert.equal(await evaluate(`(() => { const button = document.querySelector('.hero-actions .button-coral'); if (!button) return false; button.click(); return true })()`), true)
  await waitForText('START WHERE YOU ARE')
  assert.equal(await evaluate(`(() => {
    const textarea = document.querySelector('.concern-field textarea')
    if (!textarea) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(textarea, 'Work has been overwhelming and anxious thoughts keep me awake at night. I would like someone who understands burnout.')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`), true)
  await clickButton('Review my summary')
  await waitForText('Did we understand you correctly?')
  const aiSummaryState = await evaluate(`(() => {
    const summary = document.querySelector('.analysis-card > p')
    const provider = document.querySelector('.analysis-title small')
    return {
      text: summary?.textContent.trim() || '',
      provider: provider?.textContent.trim() || '',
      fontSize: summary ? parseFloat(getComputedStyle(summary).fontSize) : 0,
    }
  })()`)
  assert.ok(aiSummaryState.text.length >= 30, 'AI-assisted summary should contain useful text')
  assert.ok(aiSummaryState.provider.includes('AI-assisted'), 'AI provider/fallback should be visible')
  assert.ok(aiSummaryState.fontSize >= 14, 'AI summary should be readable')

  const themeBeforeContrastCheck = await evaluate(`document.documentElement.dataset.theme`)
  if (themeBeforeContrastCheck !== 'dark') {
    assert.equal(await evaluate(`(() => { const button = document.querySelector('button[aria-label^="Switch to "]'); if (!button) return false; button.click(); return true })()`), true)
  }
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark')
  const darkContrast = await evaluate(`(() => {
    const element = document.querySelector('.analysis-card > p')
    const parse = (value) => value.match(/[\\d.]+/g).slice(0, 3).map(Number)
    const luminance = (rgb) => {
      const channels = rgb.map((channel) => { const value = channel / 255; return value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4 })
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
    }
    const style = getComputedStyle(element)
    const foreground = luminance(parse(style.color))
    const background = luminance(parse(style.backgroundColor))
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05)
  })()`)
  assert.ok(darkContrast >= 4.5, `Dark-mode summary contrast should meet WCAG AA; received ${darkContrast}`)
  await clickAriaLabel('Close')

  await clickButton('Community')
  await waitForText('Real people, honest moments')
  await clickButton('Resources')
  await waitForText('Something helpful for this moment')
  await waitForText('A gentle guide to grounding yourself')
  await clickButton('Open resource')
  await waitForText('Educational information only')
  await clickAriaLabel('Close')
  await clickButton('Settings')
  await waitForText('Privacy preferences')
  await clickButton('Help center')
  await waitForText('Frequently asked questions')
  await clickButton('Peer support')
  await waitForText('Your support journey')

  await clickButton('Home')
  await waitForText('You don’t have to carry it alone')
  const inheritedDarkText = await evaluate(`(() => {
    const luminance = (value) => {
      const rgb = value.match(/[\\d.]+/g).slice(0, 3).map(Number)
      const channels = rgb.map((channel) => { const item = channel / 255; return item <= .03928 ? item / 12.92 : ((item + .055) / 1.055) ** 2.4 })
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
    }
    return {
      profile: luminance(getComputedStyle(document.querySelector('.profile-name')).color),
      journey: luminance(getComputedStyle(document.querySelector('.journey-card h3')).color),
    }
  })()`)
  assert.ok(inheritedDarkText.profile >= .6, 'Profile name should remain bright in dark mode')
  assert.ok(inheritedDarkText.journey >= .6, 'Dashboard card titles should remain bright in dark mode')
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(join(process.cwd(), 'mentalbridge-complete-dashboard.png'), Buffer.from(screenshot.data, 'base64'))

  const adminRole = await evaluate(`(async () => { const response = await fetch('/api/auth/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@mentalbridge.demo', password: 'Demo123!' }) }); const data = await response.json(); localStorage.setItem('mentalbridge-token', data.token); return data.user.role })()`, true)
  assert.equal(adminRole, 'admin')
  await send('Page.reload', { ignoreCache: true })
  await waitForText('Care operations')
  await waitForText('People & roles')
  await clickAdminTab('People & roles')
  await waitForText('People and platform roles')
  await clickAdminTab('Reports')
  await waitForText('Reported content')
  await clickAdminTab('Resources')
  await waitForText('Educational resources')
  await waitForText('Add resource')
  const adminScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(join(process.cwd(), 'mentalbridge-admin.png'), Buffer.from(adminScreenshot.data, 'base64'))

  console.log('UI smoke test passed: landing page, themes, live navigation counts, AI-assisted summary, readable contrast, member navigation, resources, support, and role-based administration.')
} finally {
  socket?.close()
  chrome.kill()
  await delay(150)
  await rm(profileDirectory, { recursive: true, force: true }).catch(() => undefined)
}
