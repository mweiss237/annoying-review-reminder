import * as vscode from 'vscode';
import { PendingReview, ReminderAction, ReminderLevel } from '../types';
import { saveOriginalColors } from '../state';
import { updateStatusBar } from './gentle';

let soundPanel: vscode.WebviewPanel | undefined;

function formatReviewDocument(reviews: PendingReview[]): string {
  const border = '═'.repeat(60);
  const lines = [
    border,
    '  🚨🚨🚨  PENDING REVIEWS — ACT NOW  🚨🚨🚨',
    border,
    '',
    `  You have ${reviews.length} pull request${reviews.length === 1 ? '' : 's'} waiting for your review.`,
    '  Stop what you are doing and REVIEW THEM.',
    '',
    border,
    '',
  ];

  for (const review of reviews) {
    lines.push(`  📋 ${review.repo}#${review.number}`);
    lines.push(`     "${review.title}"`);
    lines.push(`     by @${review.author} — ${new Date(review.createdAt).toLocaleDateString()}`);
    lines.push(`     ✅ +${review.additions}  ❌ -${review.deletions}`);
    lines.push(`     🔗 ${review.url}`);
    lines.push('');
  }

  lines.push(border);
  lines.push('  Use command "Review Reminder: I Promise to Review!" to dismiss.');
  lines.push(border);

  return lines.join('\n');
}

function playSound(context: vscode.ExtensionContext): void {
  if (soundPanel) {
    return;
  }
  soundPanel = vscode.window.createWebviewPanel(
    'reviewReminderSound',
    'Review Reminder',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true }
  );

  // Make the panel as small/hidden as possible
  soundPanel.webview.html = `<!DOCTYPE html>
<html>
<body style="background:#1e1e1e;color:#ccc;padding:20px;font-family:monospace;">
  <h2>🔔 Review Reminder Active</h2>
  <p>A sound is playing to remind you about pending reviews.</p>
  <p>Use command <strong>"Review Reminder: Snooze All Reminders"</strong> to stop.</p>
  <script>
    const ctx = new AudioContext();
    function beep(freq, duration) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }
    function playPattern() {
      beep(800, 0.2);
      setTimeout(() => beep(1000, 0.2), 300);
      setTimeout(() => beep(800, 0.2), 600);
    }
    playPattern();
    setInterval(playPattern, 3000);
  </script>
</body>
</html>`;

  soundPanel.onDidDispose(() => {
    soundPanel = undefined;
  });
}

export const intrusive: ReminderLevel = {
  name: 'Intrusive',

  async execute(
    reviews: PendingReview[],
    context: vscode.ExtensionContext
  ): Promise<ReminderAction> {
    updateStatusBar(reviews.length);

    await saveOriginalColors();

    // Tint editor red
    await vscode.workspace
      .getConfiguration('workbench')
      .update(
        'colorCustomizations',
        {
          'editor.background': '#3a0000',
          'sideBar.background': '#2a0000',
          'activityBar.background': '#2a0000',
          'statusBar.background': '#8b0000',
          'titleBar.activeBackground': '#5a0000',
        },
        vscode.ConfigurationTarget.Global
      );

    // Pop up a text document with the review list
    const content = formatReviewDocument(reviews);
    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'plaintext',
    });
    await vscode.window.showTextDocument(doc, {
      preview: false,
      viewColumn: vscode.ViewColumn.Active,
    });

    // Play sound
    playSound(context);

    const action = await vscode.window.showErrorMessage(
      `🔊 ${reviews.length} reviews need your attention NOW! A reminder document has been opened.`,
      'Open First PR',
      'Snooze'
    );

    if (action === 'Open First PR') {
      await vscode.env.openExternal(vscode.Uri.parse(reviews[0].url));
      return 'opened';
    }
    if (action === 'Snooze') {
      return 'snoozed';
    }
    return 'dismissed';
  },

  cleanup() {
    soundPanel?.dispose();
    soundPanel = undefined;
  },
};

export function disposeSoundPanel(): void {
  soundPanel?.dispose();
  soundPanel = undefined;
}
