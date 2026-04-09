import * as vscode from 'vscode';
import { PendingReview, ReminderAction, ReminderLevel } from '../types';
import { saveOriginalColors, restoreOriginalColors } from '../state';
import { updateStatusBar } from './gentle';

export const pushy: ReminderLevel = {
  name: 'Pushy',

  async execute(reviews: PendingReview[]): Promise<ReminderAction> {
    updateStatusBar(reviews.length);

    await saveOriginalColors();

    // Tint the editor background red
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

    const prList = reviews
      .slice(0, 8)
      .map((r) => `• ${r.repo}#${r.number}: ${r.title} (by ${r.author}) [+${r.additions} / -${r.deletions}]`)
      .join('\n');

    const extra =
      reviews.length > 8 ? `\n...and ${reviews.length - 8} more` : '';

    const action = await vscode.window.showWarningMessage(
      `🚨 You have ${reviews.length} pending review${reviews.length === 1 ? '' : 's'}! Your editor will stay red until you act.\n\n${prList}${extra}`,
      { modal: true },
      'Open First PR',
      'Open All',
    );

    if (action === 'Open First PR') {
      await vscode.env.openExternal(vscode.Uri.parse(reviews[0].url));
      await restoreOriginalColors();
      return 'opened';
    }
    if (action === 'Open All') {
      for (const review of reviews.slice(0, 5)) {
        await vscode.env.openExternal(vscode.Uri.parse(review.url));
      }
      await restoreOriginalColors();
      return 'opened';
    }

    // Dismissed — colors stay red!
    return 'dismissed';
  },

  cleanup() {
    restoreOriginalColors();
  },
};
