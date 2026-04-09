import * as vscode from 'vscode';
import { PendingReview, ReminderAction, ReminderLevel } from '../types';
import { saveOriginalColors } from '../state';
import { updateStatusBar } from './gentle';

let webviewPanel: vscode.WebviewPanel | undefined;
let colorCycleInterval: ReturnType<typeof setInterval> | undefined;

const AGGRESSIVE_COLORS = [
  {
    'editor.background': '#4a0000',
    'sideBar.background': '#3a0000',
    'activityBar.background': '#4a0000',
    'statusBar.background': '#ff0000',
    'titleBar.activeBackground': '#6a0000',
  },
  {
    'editor.background': '#4a2800',
    'sideBar.background': '#3a2000',
    'activityBar.background': '#4a2800',
    'statusBar.background': '#ff6600',
    'titleBar.activeBackground': '#5a3000',
  },
  {
    'editor.background': '#4a4a00',
    'sideBar.background': '#3a3a00',
    'activityBar.background': '#4a4a00',
    'statusBar.background': '#ffcc00',
    'titleBar.activeBackground': '#5a5a00',
  },
];

function buildWebviewHtml(reviews: PendingReview[]): string {
  const reviewRows = reviews
    .map(
      (r) => `
      <tr class="shake">
        <td>${escapeHtml(r.repo)}#${r.number}</td>
        <td>${escapeHtml(r.title)}</td>
        <td>@${escapeHtml(r.author)}</td>
        <td><span style="color:#4caf50;font-weight:bold">+${r.additions}</span> / <span style="color:#f44336;font-weight:bold">-${r.deletions}</span></td>
        <td><button onclick="openPr('${escapeHtml(r.url)}')">REVIEW NOW</button></td>
      </tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', monospace;
    color: white;
    overflow: hidden;
    animation: bgFlash 0.5s infinite;
  }
  @keyframes bgFlash {
    0% { background: #ff0000; }
    25% { background: #ff6600; }
    50% { background: #ff0000; }
    75% { background: #cc0000; }
    100% { background: #ff0000; }
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10% { transform: translateX(-5px) rotate(-1deg); }
    20% { transform: translateX(5px) rotate(1deg); }
    30% { transform: translateX(-5px) rotate(0deg); }
    40% { transform: translateX(5px) rotate(1deg); }
    50% { transform: translateX(-3px) rotate(-1deg); }
    60% { transform: translateX(3px) rotate(0deg); }
    70% { transform: translateX(-3px) rotate(-1deg); }
    80% { transform: translateX(3px) rotate(1deg); }
    90% { transform: translateX(-1px) rotate(0deg); }
  }
  .shake { animation: shake 0.5s infinite; }
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
  }
  h1 {
    font-size: 3em;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    margin-bottom: 10px;
    animation: shake 0.3s infinite;
  }
  h2 {
    font-size: 1.5em;
    margin-bottom: 30px;
    opacity: 0.9;
  }
  table {
    border-collapse: collapse;
    width: 90%;
    max-width: 900px;
    background: rgba(0,0,0,0.5);
    border-radius: 10px;
    overflow: hidden;
  }
  th, td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid rgba(255,255,255,0.2);
  }
  th { background: rgba(0,0,0,0.3); font-size: 1.1em; }
  button {
    background: #fff;
    color: #ff0000;
    border: none;
    padding: 8px 20px;
    font-weight: bold;
    font-size: 1em;
    cursor: pointer;
    border-radius: 5px;
    animation: shake 0.4s infinite;
  }
  button:hover { background: #ffcccc; }
  .warning {
    margin-top: 30px;
    font-size: 1.2em;
    text-align: center;
    animation: shake 0.3s infinite;
  }
</style>
</head>
<body>
  <div class="container">
    <h1>🚨 REVIEW YOUR PRs NOW 🚨</h1>
    <h2>${reviews.length} pull request${reviews.length === 1 ? '' : 's'} need your review!</h2>
    <table>
      <tr><th>Repo</th><th>Title</th><th>Author</th><th>Changes</th><th>Action</th></tr>
      ${reviewRows}
    </table>
    <p class="warning">
      ⚠️ This will keep getting worse until you review your PRs! ⚠️<br/>
      Use command "Review Reminder: Snooze All Reminders" for temporary relief.
    </p>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function openPr(url) { vscode.postMessage({ command: 'openPr', url }); }

    // Alarm sound
    const ctx = new AudioContext();
    function alarm() {
      [400, 600, 800, 1000, 800, 600].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.value = 0.25;
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.12);
      });
    }
    alarm();
    setInterval(alarm, 2000);
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function startColorCycling(): void {
  if (colorCycleInterval) {
    return;
  }
  let index = 0;
  colorCycleInterval = setInterval(async () => {
    const colors = AGGRESSIVE_COLORS[index % AGGRESSIVE_COLORS.length];
    await vscode.workspace
      .getConfiguration('workbench')
      .update(
        'colorCustomizations',
        colors,
        vscode.ConfigurationTarget.Global
      );
    index++;
  }, 600);
}

function stopColorCycling(): void {
  if (colorCycleInterval) {
    clearInterval(colorCycleInterval);
    colorCycleInterval = undefined;
  }
}

export const aggressive: ReminderLevel = {
  name: 'Aggressive',

  async execute(
    reviews: PendingReview[],
    context: vscode.ExtensionContext
  ): Promise<ReminderAction> {
    updateStatusBar(reviews.length);
    await saveOriginalColors();

    // Start color cycling
    startColorCycling();

    // Create the webview panel
    if (!webviewPanel) {
      webviewPanel = vscode.window.createWebviewPanel(
        'aggressiveReminder',
        '🚨 REVIEW YOUR PRs 🚨',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );

      webviewPanel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'openPr') {
          await vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
      });

      webviewPanel.onDidDispose(() => {
        webviewPanel = undefined;
      });
    }

    webviewPanel.webview.html = buildWebviewHtml(reviews);
    webviewPanel.reveal(vscode.ViewColumn.One);

    const action = await vscode.window.showErrorMessage(
      `🚨🚨🚨 ${reviews.length} REVIEWS PENDING! Hey! Your colleagues are waiting! 🚨🚨🚨`,
      { modal: true },
      'Open All PRs',
    );

    if (action === 'Open All PRs') {
      for (const review of reviews.slice(0, 10)) {
        await vscode.env.openExternal(vscode.Uri.parse(review.url));
      }
      stopColorCycling();
      return 'opened';
    }
    // Color cycling continues on dismiss!
    return 'dismissed';
  },

  cleanup() {
    stopColorCycling();
    webviewPanel?.dispose();
    webviewPanel = undefined;
  },
};

export function disposeAggressive(): void {
  stopColorCycling();
  webviewPanel?.dispose();
  webviewPanel = undefined;
}
