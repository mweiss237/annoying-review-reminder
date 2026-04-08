import * as vscode from 'vscode';
import { PendingReview, ReminderAction, ReminderLevel } from '../types';
import { updateStatusBar } from './gentle';

export const nudge: ReminderLevel = {
  name: 'Nudge',

  async execute(reviews: PendingReview[]): Promise<ReminderAction> {
    updateStatusBar(reviews.length);

    const prList = reviews
      .slice(0, 5)
      .map((r) => `${r.repo}#${r.number}: ${r.title}`)
      .join(' | ');

    const extra =
      reviews.length > 5 ? ` (+${reviews.length - 5} more)` : '';

    const action = await vscode.window.showWarningMessage(
      `⚠️ ${reviews.length} PR review${reviews.length === 1 ? '' : 's'} waiting for you! ${prList}${extra}`,
      'Open First PR',
      'Open All in Browser',
      'Snooze'
    );

    if (action === 'Open First PR') {
      await vscode.env.openExternal(vscode.Uri.parse(reviews[0].url));
      return 'opened';
    }
    if (action === 'Open All in Browser') {
      for (const review of reviews.slice(0, 5)) {
        await vscode.env.openExternal(vscode.Uri.parse(review.url));
      }
      return 'opened';
    }
    if (action === 'Snooze') {
      return 'snoozed';
    }
    return 'dismissed';
  },
};
