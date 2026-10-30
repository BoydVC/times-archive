// Clicks "Next" in the reader via Chrome DevTools Protocol, screenshots mid-flip, and checks the page advanced.
// Run: node --experimental-websocket tests/flip_check.mjs
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const URL = process.env.URL || 'http://127.0.0.1:4645';
const port = 9555 + Math.floor(Math.random() * 300);
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, '--window-size=1440,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = false;
try {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); } }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending[m.id]) { pending[m.id](m.result); delete pending[m.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: URL + '/#/read/030/1' });
  await sleep(2500);
  const before = await evalJs("document.querySelector('#pglabel').textContent");
  await evalJs("document.querySelector('#bNext').click()");
  await sleep(300);
  const leafMid = await evalJs("!!document.querySelector('.leaf')");
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('screenshots/09-page-flip.png', Buffer.from(shot.data, 'base64'));
  await sleep(900);
  const after = await evalJs("document.querySelector('#pglabel').textContent");
  const leafGone = await evalJs("!document.querySelector('.leaf')");
  console.log({ before, after, leafMid, leafGone });
  ok = before.startsWith('Page 1') && after.startsWith('Page 2') && leafMid && leafGone;
  ws.close();
} catch (e) { console.error(e); }
chrome.kill();
console.log(ok ? 'PASS page flip' : 'FAIL page flip');
process.exit(ok ? 0 : 1);
