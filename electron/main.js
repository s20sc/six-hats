import { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import net from 'node:net'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// GUI apps launched from Finder inherit a minimal PATH, so the backend can't find
// claude / codex / ollama / openclaw. Recover the login-shell PATH and always append
// the common install dirs as a backstop.
function resolvePath() {
  let loginPath = ''
  try {
    const shellBin = process.env.SHELL || '/bin/zsh'
    loginPath = execFileSync(shellBin, ['-lc', 'printf %s "$PATH"'], { encoding: 'utf8', timeout: 5000 }).trim()
  } catch {}
  const extras = ['/opt/homebrew/bin', '/usr/local/bin', `${process.env.HOME}/.local/bin`, '/usr/bin', '/bin', '/usr/sbin', '/sbin']
  const seen = new Set()
  return [loginPath, ...extras]
    .flatMap((p) => p.split(':'))
    .filter((p) => p && !seen.has(p) && seen.add(p))
    .join(':')
}
process.env.PATH = resolvePath()

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)) })
  })
}

let mainWindow = null
let tray = null
let serverInfo = null

async function startServer() {
  const port = await freePort()
  process.env.PORT = String(port)
  process.env.HOST = '127.0.0.1'
  const { start } = await import(join(ROOT, 'src/server/server.js'))
  serverInfo = await start()
}

function showWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); return }
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 900,
    minWidth: 720,
    minHeight: 560,
    title: 'Six Hats',
    backgroundColor: '#f3efe6',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  mainWindow.loadURL(`http://127.0.0.1:${serverInfo.port}`)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide() } // keep running in the menu bar
  })
}

function createTray() {
  const icon = nativeImage.createFromPath(join(__dirname, 'trayTemplate.png'))
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Six Hats · 六顶思考帽')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 Six Hats', click: showWindow },
    { label: `后端运行于 :${serverInfo?.port ?? '—'}`, enabled: false },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit() } },
  ]))
  tray.on('click', showWindow)
}

app.setName('Six Hats')

app.whenReady().then(async () => {
  try {
    await startServer()
  } catch (err) {
    dialog.showErrorBox('Six Hats 启动失败', String(err?.stack || err))
    app.isQuitting = true
    app.quit()
    return
  }
  createTray()
  showWindow()
  app.on('activate', showWindow)
})

// Keep the app alive in the menu bar when the window is closed.
app.on('window-all-closed', () => {})
