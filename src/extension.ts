import * as vscode from 'vscode';
import { getConfig } from './config';
import {
    initState,
    resetAllDismissCounts,
    setSnooze,
    restoreOriginalColors,
    restoreOriginalTheme,
} from './state';
import { getGitHubSession } from './github/auth';
import {
    startPolling,
    poll,
    restartPolling,
    fullCleanup,
    getOutputChannel,
} from './reminders/engine';
import { stopNuclear } from './reminders/nuclear';
import { disposeAggressive } from './reminders/aggressive';
import { disposeSoundPanel } from './reminders/intrusive';

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const output = getOutputChannel();
  output.appendLine('Annoying Review Reminder activating...');

  // Initialize persistent state
  initState(context.globalState);

  // Try to authenticate silently first
  try {
    await getGitHubSession(false);
    output.appendLine('GitHub authentication: already signed in');
  } catch {
    output.appendLine(
      'GitHub authentication: not signed in yet, will prompt on first poll'
    );
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'annoyingReviewReminder.refresh',
      async () => {
        output.appendLine('Manual refresh triggered');
        await poll(context);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'annoyingReviewReminder.snooze',
      async () => {
        const config = getConfig();
        await setSnooze(config.snoozeDurationMinutes);
        stopNuclear();
        disposeAggressive();
        disposeSoundPanel();
        await restoreOriginalColors();
        await restoreOriginalTheme();
        vscode.window.showInformationMessage(
          `Review reminders snoozed for ${config.snoozeDurationMinutes} minutes.`
        );
        output.appendLine(
          `Snoozed for ${config.snoozeDurationMinutes} minutes`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'annoyingReviewReminder.resetEscalation',
      async () => {
        await resetAllDismissCounts();
        stopNuclear();
        disposeAggressive();
        disposeSoundPanel();
        await restoreOriginalColors();
        await restoreOriginalTheme();
        vscode.window.showInformationMessage(
          'Escalation reset. All effects restored to normal.'
        );
        output.appendLine('Escalation reset and effects cleaned up');
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'annoyingReviewReminder.selectRepos',
      async () => {
        const session = await getGitHubSession(true);

        // Fetch user's repos from GitHub
        const response = await fetch(
          'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
          {
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              Accept: 'application/vnd.github+json',
            },
          }
        );

        if (!response.ok) {
          vscode.window.showErrorMessage('Failed to fetch repositories.');
          return;
        }

        const repos = (await response.json()) as Array<{
          full_name: string;
        }>;
        const repoNames = repos.map((r) => r.full_name);
        const currentConfig = getConfig();

        const selected = await vscode.window.showQuickPick(
          repoNames.map((name) => ({
            label: name,
            picked: currentConfig.repos.includes(name),
          })),
          {
            canPickMany: true,
            placeHolder:
              'Select repositories to watch (leave empty for all)',
            title: 'Review Reminder: Select Repositories',
          }
        );

        if (selected !== undefined) {
          const selectedRepos = selected.map((s) => s.label);
          await vscode.workspace
            .getConfiguration('annoyingReviewReminder')
            .update(
              'repos',
              selectedRepos,
              vscode.ConfigurationTarget.Global
            );
          vscode.window.showInformationMessage(
            selectedRepos.length > 0
              ? `Now watching: ${selectedRepos.join(', ')}`
              : 'Watching all repositories with pending reviews.'
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'annoyingReviewReminder.promiseToReview',
      async () => {
        // Nuclear escape hatch
        stopNuclear();
        disposeAggressive();
        disposeSoundPanel();
        await restoreOriginalColors();
        await restoreOriginalTheme();
        await resetAllDismissCounts();

        vscode.window.showInformationMessage(
          '🤝 You promised to review! Escalation reset. We\'ll check again in 10 minutes...',
        );

        // Set a short snooze (10 minutes) then re-escalate if not done
        await setSnooze(10);
        output.appendLine(
          'Nuclear mode stopped — promise to review with 10-minute grace period'
        );
      }
    )
  );

  // Listen for configuration changes to restart polling with new interval
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('annoyingReviewReminder')) {
        output.appendLine('Configuration changed, restarting polling');
        restartPolling(context);
      }
    })
  );

  // Start the polling loop
  startPolling(context);

  output.appendLine('Annoying Review Reminder activated!');
}

export function deactivate(): void {
  fullCleanup();
  restoreOriginalColors();
  restoreOriginalTheme();
}
