import * as vscode from 'vscode';
import { getConfig } from '../config';
import { fetchPendingReviews } from '../github/api';
import {
    getDismissCount,
    incrementDismiss,
    resetDismiss,
    isSnoozing,
    setSnooze,
    cleanupStale,
    getMaxLevel,
    getFirstSnoozeTimestamp,
    setFirstSnoozeTimestamp,
    clearFirstSnoozeTimestamp,
    restoreOriginalColors,
    restoreOriginalTheme,
} from '../state';
import { getLevel } from './levels';
import { disposeStatusBar, updateStatusBar } from './gentle';
import { disposeSoundPanel } from './intrusive';
import { disposeAggressive } from './aggressive';
import { stopNuclear } from './nuclear';

let pollInterval: ReturnType<typeof setInterval> | undefined;
let isPolling = false;
let paused = false;
let lastReviews: import('../types').PendingReview[] = [];
let outputChannel: vscode.OutputChannel;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Review Reminder');
  }
  return outputChannel;
}

function log(message: string): void {
  getOutputChannel().appendLine(
    `[${new Date().toLocaleTimeString()}] ${message}`
  );
}

export function getLastReviews(): import('../types').PendingReview[] {
  return lastReviews;
}

export function isPaused(): boolean {
  return paused;
}

export function togglePause(context: vscode.ExtensionContext): void {
  paused = !paused;
  if (paused) {
    stopPolling();
    log('Extension paused');
  } else {
    startPolling(context);
    log('Extension resumed');
  }
  updateStatusBar(paused ? 0 : lastReviews.length, paused);
}

export async function poll(context: vscode.ExtensionContext): Promise<void> {
  if (isPolling) {
    log('Skipping poll — previous one still running');
    return;
  }

  const config = getConfig();
  if (!config.enabled || paused) {
    log(paused ? 'Extension paused, skipping poll' : 'Extension disabled, skipping poll');
    updateStatusBar(0, paused);
    return;
  }

  if (isSnoozing()) {
    log('Currently snoozing, skipping poll');
    return;
  }

  isPolling = true;

  try {
    log('Fetching pending reviews...');
    const reviews = await fetchPendingReviews();
    log(`Found ${reviews.length} pending review(s)`);

    lastReviews = reviews;

    if (reviews.length === 0) {
      updateStatusBar(0, false);
      await cleanupStale(new Set());
      cleanupAllEffects();
      await restoreOriginalColors();
      await restoreOriginalTheme();
      return;
    }

    // Clean up stale dismiss counts for PRs no longer pending
    const currentIds = new Set(reviews.map((r) => r.id));
    await cleanupStale(currentIds);

    // Escalate if snooze threshold exceeded
    const thresholdMs = config.snoozeEscalationThresholdMinutes * 60 * 1000;
    for (const review of reviews) {
      const firstSnooze = getFirstSnoozeTimestamp(review.id);
      if (firstSnooze !== undefined && Date.now() - firstSnooze >= thresholdMs) {
        await incrementDismiss(review.id);
        await clearFirstSnoozeTimestamp(review.id);
        log(`Snooze threshold exceeded for ${review.repo}#${review.number}, escalating`);
      }
    }

    // Determine the highest escalation level across all pending reviews
    let maxActiveLevel = 0;
    for (const review of reviews) {
      const dismissCount = getDismissCount(review.id);
      const level = getMaxLevel(dismissCount, config.maxBrutalityLevel);
      maxActiveLevel = Math.max(maxActiveLevel, level);
    }

    log(
      `Highest escalation level: ${maxActiveLevel} (${getLevel(maxActiveLevel).name})`
    );

    // Execute the highest level with all reviews
    const levelHandler = getLevel(maxActiveLevel);
    const action = await levelHandler.execute(reviews, context);

    log(`User action: ${action}`);

    // Handle the result
    switch (action) {
      case 'dismissed':
        // Increment dismiss count for all reviews
        for (const review of reviews) {
          await incrementDismiss(review.id);
        }
        break;

      case 'snoozed':
        for (const review of reviews) {
          await setFirstSnoozeTimestamp(review.id);
        }
        await setSnooze(config.snoozeDurationMinutes);
        cleanupAllEffects();
        await restoreOriginalColors();
        await restoreOriginalTheme();
        log(`Snoozed for ${config.snoozeDurationMinutes} minutes`);
        break;

      case 'opened':
        // Reset dismiss counts and snooze timestamps for opened reviews
        for (const review of reviews) {
          await resetDismiss(review.id);
          await clearFirstSnoozeTimestamp(review.id);
        }
        cleanupAllEffects();
        await restoreOriginalColors();
        await restoreOriginalTheme();
        break;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    log(`Error during poll: ${message}`);

    if (
      message.includes('GitHub authentication required') ||
      message.includes('401')
    ) {
      vscode.window.showErrorMessage(
        'Review Reminder: GitHub authentication required. Please sign in.',
        'Sign In'
      ).then(async (action) => {
        if (action === 'Sign In') {
          const { getGitHubSession } = await import('../github/auth');
          await getGitHubSession(true);
        }
      });
    }
  } finally {
    isPolling = false;
  }
}

export function startPolling(context: vscode.ExtensionContext): void {
  const config = getConfig();
  const intervalMs = config.pollIntervalSeconds * 1000;

  log(`Starting polling every ${config.pollIntervalSeconds} seconds`);

  // Initial poll after a short delay to let VS Code finish starting
  setTimeout(() => poll(context), 3000);

  pollInterval = setInterval(() => poll(context), intervalMs);

  context.subscriptions.push({
    dispose: () => {
      stopPolling();
    },
  });
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = undefined;
  }
  log('Polling stopped');
}

export function restartPolling(context: vscode.ExtensionContext): void {
  stopPolling();
  startPolling(context);
}

function cleanupAllEffects(): void {
  disposeSoundPanel();
  disposeAggressive();
  stopNuclear();
}

export function fullCleanup(): void {
  stopPolling();
  cleanupAllEffects();
  disposeStatusBar();
}
