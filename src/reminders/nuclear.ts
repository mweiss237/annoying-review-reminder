import * as vscode from 'vscode';
import { PendingReview, ReminderAction, ReminderLevel } from '../types';
import {
  saveOriginalColors,
  saveOriginalTheme,
} from '../state';
import { updateStatusBar } from './gentle';

let webviewPanels: vscode.WebviewPanel[] = [];
let colorCycleInterval: ReturnType<typeof setInterval> | undefined;
let themeCycleInterval: ReturnType<typeof setInterval> | undefined;
let docSpawnInterval: ReturnType<typeof setInterval> | undefined;
let isActive = false;

const NUCLEAR_THEMES = [
  'Default Light Modern',
  'Default Dark Modern',
  'Default High Contrast',
  'Default High Contrast Light',
];

const NUCLEAR_COLORS = [
  {
    'editor.background': '#ff0000',
    'sideBar.background': '#cc0000',
    'activityBar.background': '#ff0000',
    'statusBar.background': '#ff0000',
    'titleBar.activeBackground': '#ff0000',
    'editor.foreground': '#ffffff',
  },
  {
    'editor.background': '#ff6600',
    'sideBar.background': '#cc5500',
    'activityBar.background': '#ff6600',
    'statusBar.background': '#ff6600',
    'titleBar.activeBackground': '#ff6600',
    'editor.foreground': '#000000',
  },
  {
    'editor.background': '#ffff00',
    'sideBar.background': '#cccc00',
    'activityBar.background': '#ffff00',
    'statusBar.background': '#ffff00',
    'titleBar.activeBackground': '#ffff00',
    'editor.foreground': '#000000',
  },
  {
    'editor.background': '#ff00ff',
    'sideBar.background': '#cc00cc',
    'activityBar.background': '#ff00ff',
    'statusBar.background': '#ff00ff',
    'titleBar.activeBackground': '#ff00ff',
    'editor.foreground': '#ffffff',
  },
  {
    'editor.background': '#00ffff',
    'sideBar.background': '#00cccc',
    'activityBar.background': '#00ffff',
    'statusBar.background': '#00ffff',
    'titleBar.activeBackground': '#00ffff',
    'editor.foreground': '#000000',
  },
];

function buildNuclearHtml(
  reviews: PendingReview[],
  panelIndex: number
): string {
  const urgencyTexts = [
    'REVIEW YOUR PULL REQUESTS IMMEDIATELY',
    'YOUR TEAM IS WAITING FOR YOU',
    'STOP EVERYTHING AND REVIEW NOW',
  ];

  const reviewRows = reviews
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.repo)}#${r.number}</td>
        <td>${escapeHtml(r.title)}</td>
        <td>@${escapeHtml(r.author)}</td>
        <td><span style="color:#4caf50;font-weight:bold">+${r.additions}</span> / <span style="color:#f44336;font-weight:bold">-${r.deletions}</span></td>
        <td><button onclick="openPr('${escapeHtml(r.url)}')">REVIEW</button></td>
      </tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; }
  body {
    font-family: 'Impact', 'Arial Black', sans-serif;
    color: white;
    overflow: hidden;
    animation: nuclearBg 0.3s infinite;
  }
  @keyframes nuclearBg {
    0% { background: #ff0000; }
    20% { background: #ff00ff; }
    40% { background: #ffff00; }
    60% { background: #00ff00; }
    80% { background: #0000ff; }
    100% { background: #ff0000; }
  }
  @keyframes violent-shake {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    10% { transform: translate(-15px, -10px) rotate(-3deg); }
    20% { transform: translate(15px, 10px) rotate(3deg); }
    30% { transform: translate(-20px, 5px) rotate(-2deg); }
    40% { transform: translate(20px, -5px) rotate(2deg); }
    50% { transform: translate(-10px, -15px) rotate(-4deg); }
    60% { transform: translate(10px, 15px) rotate(4deg); }
    70% { transform: translate(-15px, 10px) rotate(-2deg); }
    80% { transform: translate(15px, -10px) rotate(2deg); }
    90% { transform: translate(-5px, -5px) rotate(-1deg); }
  }
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
    animation: violent-shake 0.15s infinite;
  }
  h1 {
    font-size: 4em;
    text-shadow: 3px 3px 6px rgba(0,0,0,0.8);
    margin-bottom: 10px;
    animation: violent-shake 0.1s infinite;
  }
  h2 {
    font-size: 2em;
    margin-bottom: 20px;
    text-shadow: 2px 2px black;
  }
  .countdown {
    font-size: 1.5em;
    margin-bottom: 20px;
    background: rgba(0,0,0,0.5);
    padding: 10px 30px;
    border-radius: 10px;
  }
  table {
    border-collapse: collapse;
    width: 90%;
    max-width: 800px;
    background: rgba(0,0,0,0.6);
    border-radius: 10px;
    overflow: hidden;
    animation: violent-shake 0.2s infinite;
  }
  th, td { padding: 10px 15px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.3); }
  th { background: rgba(0,0,0,0.3); }
  button {
    background: white;
    color: red;
    border: 3px solid yellow;
    padding: 10px 25px;
    font-weight: bold;
    font-size: 1.1em;
    cursor: pointer;
    border-radius: 5px;
    animation: violent-shake 0.2s infinite;
  }
  .escape {
    margin-top: 30px;
    font-size: 1.3em;
    text-align: center;
    background: rgba(0,0,0,0.5);
    padding: 15px;
    border-radius: 10px;
    animation: violent-shake 0.15s infinite;
  }
</style>
</head>
<body>
  <div class="container">
    <h1>☢️ NUCLEAR REVIEW ALERT ☢️</h1>
    <h2>${urgencyTexts[panelIndex % urgencyTexts.length]}</h2>
    <div class="countdown">
      ${reviews.length} PR${reviews.length === 1 ? '' : 's'} AWAITING YOUR REVIEW
    </div>
    <table>
      <tr><th>Repository</th><th>Pull Request</th><th>Author</th><th>Changes</th><th></th></tr>
      ${reviewRows}
    </table>
    <div class="escape">
      🆘 The ONLY way out: run command<br/>
      <strong>"Review Reminder: I Promise to Review!"</strong><br/>
      or actually open the PRs above
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function openPr(url) { vscode.postMessage({ command: 'openPr', url }); }

    // Aggressive alarm
    const ctx = new AudioContext();
    function nuclearAlarm() {
      const freqs = [200, 400, 600, 800, 1000, 1200, 1000, 800, 600, 400, 200, 400, 800, 1200];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = ${panelIndex % 2 === 0 ? "'sawtooth'" : "'square'"};
        osc.frequency.value = freq;
        gain.gain.value = 0.2;
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.08);
      });
    }
    nuclearAlarm();
    setInterval(nuclearAlarm, 1500);
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

function startNuclearColorCycling(): void {
  if (colorCycleInterval) {
    return;
  }
  let index = 0;
  colorCycleInterval = setInterval(async () => {
    const colors = NUCLEAR_COLORS[index % NUCLEAR_COLORS.length];
    await vscode.workspace
      .getConfiguration('workbench')
      .update(
        'colorCustomizations',
        colors,
        vscode.ConfigurationTarget.Global
      );
    index++;
  }, 300);
}

function startThemeCycling(): void {
  if (themeCycleInterval) {
    return;
  }
  let index = 0;
  themeCycleInterval = setInterval(async () => {
    const theme = NUCLEAR_THEMES[index % NUCLEAR_THEMES.length];
    await vscode.workspace
      .getConfiguration('workbench')
      .update('colorTheme', theme, vscode.ConfigurationTarget.Global);
    index++;
  }, 2000);
}

function startDocSpawning(reviews: PendingReview[]): void {
  if (docSpawnInterval) {
    return;
  }
  const messages = [
    '⚠️ REVIEW YOUR PULL REQUESTS ⚠️',
    '🚨 YOUR TEAM IS WAITING 🚨',
    '☢️ THIS WILL NOT STOP ☢️',
    '📋 PENDING REVIEWS BELOW 📋',
  ];
  let i = 0;
  docSpawnInterval = setInterval(async () => {
    const header = messages[i % messages.length];
    const content = [
      '='.repeat(50),
      header,
      '='.repeat(50),
      '',
      ...reviews.map(
        (r) =>
          `→ ${r.repo}#${r.number}: ${r.title} by @${r.author}\n  ${r.url}`
      ),
      '',
      '='.repeat(50),
      'Run "Review Reminder: I Promise to Review!" to stop this.',
      '='.repeat(50),
    ].join('\n');

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'plaintext',
    });
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: (i % 3) + 1,
    });
    i++;
  }, 4000);
}

export const nuclear: ReminderLevel = {
  name: 'Nuclear',

  async execute(
    reviews: PendingReview[],
    context: vscode.ExtensionContext
  ): Promise<ReminderAction> {
    updateStatusBar(reviews.length);
    await saveOriginalColors();
    await saveOriginalTheme();

    isActive = true;

    // Start all chaos simultaneously
    startNuclearColorCycling();
    startThemeCycling();
    startDocSpawning(reviews);

    // Create 3 webview panels
    const viewColumns = [
      vscode.ViewColumn.One,
      vscode.ViewColumn.Two,
      vscode.ViewColumn.Three,
    ];

    for (let i = 0; i < 3; i++) {
      if (webviewPanels[i]?.visible) {
        continue;
      }

      const panel = vscode.window.createWebviewPanel(
        `nuclearReminder${i}`,
        `☢️ NUCLEAR ALERT ${i + 1} ☢️`,
        { viewColumn: viewColumns[i], preserveFocus: i !== 0 },
        { enableScripts: true, retainContextWhenHidden: true }
      );

      panel.webview.html = buildNuclearHtml(reviews, i);

      panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'openPr') {
          await vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
      });

      panel.onDidDispose(() => {
        const idx = webviewPanels.indexOf(panel);
        if (idx !== -1) {
          webviewPanels[idx] = undefined as unknown as vscode.WebviewPanel;
        }
      });

      webviewPanels[i] = panel;
    }

    // The only escape is the promiseToReview command, but we still show a modal
    const action = await vscode.window.showErrorMessage(
      `☢️ NUCLEAR MODE ACTIVATED ☢️\n\n${reviews.length} reviews pending.\nThe ONLY way to stop this: run "I Promise to Review!" command.`,
      { modal: true },
      'I Promise to Review'
    );

    if (action === 'I Promise to Review') {
      return 'opened';
    }

    // Dismissed — chaos continues!
    return 'dismissed';
  },

  cleanup() {
    stopNuclear();
  },
};

export function stopNuclear(): void {
  isActive = false;
  if (colorCycleInterval) {
    clearInterval(colorCycleInterval);
    colorCycleInterval = undefined;
  }
  if (themeCycleInterval) {
    clearInterval(themeCycleInterval);
    themeCycleInterval = undefined;
  }
  if (docSpawnInterval) {
    clearInterval(docSpawnInterval);
    docSpawnInterval = undefined;
  }
  for (const panel of webviewPanels) {
    panel?.dispose();
  }
  webviewPanels = [];
}

export function isNuclearActive(): boolean {
  return isActive;
}
