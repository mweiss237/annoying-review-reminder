import * as vscode from 'vscode';
import { PendingReview, ReminderAction, ReminderLevel } from '../types';

let statusBarItem: vscode.StatusBarItem | undefined;

function getOrCreateStatusBar(): vscode.StatusBarItem {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    statusBarItem.command = 'annoyingReviewReminder.showReviews';
  }
  return statusBarItem;
}

export function updateStatusBar(count: number, paused?: boolean): void {
  const bar = getOrCreateStatusBar();
  if (paused) {
    bar.text = `$(git-pull-request) Reviews (Paused)`;
    bar.tooltip = 'Click to see options — reminders paused';
    bar.show();
  } else if (count > 0) {
    bar.text = `$(git-pull-request) ${count} review${count === 1 ? '' : 's'} pending`;
    bar.tooltip = 'Click to see pending reviews';
    bar.show();
  } else {
    bar.text = '$(git-pull-request) No reviews pending';
    bar.tooltip = 'All clear!';
    bar.show();
  }
}

export const gentle: ReminderLevel = {
  name: 'Gentle',

  async execute(reviews: PendingReview[]): Promise<ReminderAction> {
    updateStatusBar(reviews.length);

    const prList = reviews
      .slice(0, 5)
      .map((r) => `• ${r.repo}#${r.number}: ${r.title} (by ${r.author})`)
      .join('\n');

    const extra =
      reviews.length > 5 ? `\n...and ${reviews.length - 5} more` : '';
    const message = `You have ${reviews.length} pending review${reviews.length === 1 ? '' : 's'}:\n${prList}${extra}`;

    const action = await vscode.window.showInformationMessage(
      message,
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
    statusBarItem?.dispose();
    statusBarItem = undefined;
  },
};

export function disposeStatusBar(): void {
  statusBarItem?.dispose();
  statusBarItem = undefined;
}
