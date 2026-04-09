import * as vscode from "vscode";
import { getConfig } from "../config";
import { fetchPendingReviews } from "../github/api";
import {
  getBrutalityLevel,
  incrementBrutalityLevel,
  resetBrutalityLevel,
  isSnoozing,
  setSnooze,
  cleanupStale,
  getLevelUpTime,
  setLevelUpTime,
  restoreOriginalColors,
  restoreOriginalTheme,
} from "../state";
import { getLevel } from "./levels";
import { disposeStatusBar, updateStatusBar } from "./gentle";
import { disposeSoundPanel } from "./intrusive";
import { disposeAggressive } from "./aggressive";
import { stopNuclear } from "./nuclear";

let pollInterval: ReturnType<typeof setInterval> | undefined;
let isPolling = false;
let paused = false;
let lastReviews: import("../types").PendingReview[] = [];
let outputChannel: vscode.OutputChannel;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Review Reminder");
  }
  return outputChannel;
}

function log(message: string): void {
  getOutputChannel().appendLine(
    `[${new Date().toLocaleTimeString()}] ${message}`,
  );
}

export function getLastReviews(): import("../types").PendingReview[] {
  return lastReviews;
}

export function isPaused(): boolean {
  return paused;
}

export function togglePause(context: vscode.ExtensionContext): void {
  paused = !paused;
  if (paused) {
    stopPolling();
    log("Extension paused");
  } else {
    startPolling(context);
    log("Extension resumed");
  }
  updateStatusBar(paused ? 0 : lastReviews.length, paused);
}

export async function poll(context: vscode.ExtensionContext): Promise<void> {
  if (isPolling) {
    log("Skipping poll — previous one still running");
    return;
  }

  const config = getConfig();
  if (!config.enabled || paused) {
    log(
      paused
        ? "Extension paused, skipping poll"
        : "Extension disabled, skipping poll",
    );
    updateStatusBar(0, paused);
    return;
  }

  isPolling = true;

  try {
    log("Fetching pending reviews...");
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

    // Clean up stale brutality levels for PRs no longer pending
    const currentIds = new Set(reviews.map(({ id }) => id));
    await cleanupStale(currentIds);

    // Check for time-based escalation: if snooze duration has passed, increase level
    const snoozeDurationMs = config.snoozeDurationMinutes * 60 * 1000;
    for (const review of reviews) {
      const lastLevelUp = getLevelUpTime(review.id);
      const currentLevel = getBrutalityLevel(review.id);

      // If this is a new PR (no level up time recorded), initialize it
      if (lastLevelUp === undefined) {
        await setLevelUpTime(review.id, Date.now());
        log(
          `New PR detected: ${review.repo}#${review.number}, starting at level ${currentLevel}`,
        );
      } else if (
        Date.now() - lastLevelUp >= snoozeDurationMs &&
        currentLevel < config.maxBrutalityLevel
      ) {
        // If snooze duration has passed since last escalation, escalate the level
        await incrementBrutalityLevel(review.id, config.maxBrutalityLevel);
        await setLevelUpTime(review.id, Date.now());
        const newLevel = getBrutalityLevel(review.id);
        log(
          `Escalation triggered for ${review.repo}#${review.number}: level ${currentLevel} → ${newLevel}`,
        );
      }
    }

    // Determine the highest brutality level across all pending reviews
    let maxActiveLevel = 0;
    for (const review of reviews) {
      const level = getBrutalityLevel(review.id);
      maxActiveLevel = Math.max(maxActiveLevel, level);
    }

    log(
      `Highest brutality level: ${maxActiveLevel} (${getLevel(maxActiveLevel).name})`,
    );

    // If currently snoozed, only update statusbar, don't show notification
    if (isSnoozing()) {
      log("Currently snoozed, updating statusbar only");
      updateStatusBar(reviews.length, false);
      return;
    }

    // Execute the highest level with all reviews
    const levelHandler = getLevel(maxActiveLevel);
    levelHandler.execute(reviews, context).then(async (action) => {
      log(`User action: ${action}`);

      // Handle the user action
      switch (action) {
        case "opened":
          // Reset brutality levels for opened reviews
          for (const review of reviews) {
            await resetBrutalityLevel(review.id);
            await setLevelUpTime(review.id, Date.now());
          }
          cleanupAllEffects();
          await restoreOriginalColors();
          await restoreOriginalTheme();
          break;

        case "dismissed":
          cleanupAllEffects();
          await restoreOriginalColors();
          await restoreOriginalTheme();
          break;
      }
    });
    await setSnooze(config.snoozeDurationMinutes);
    log(`Auto-snoozing for ${config.snoozeDurationMinutes} minutes`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log(`Error during poll: ${message}`);

    if (
      message.includes("GitHub authentication required") ||
      message.includes("401")
    ) {
      vscode.window
        .showErrorMessage(
          "Review Reminder: GitHub authentication required. Please sign in.",
          "Sign In",
        )
        .then(async (action) => {
          if (action === "Sign In") {
            const { getGitHubSession } = await import("../github/auth");
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
  log("Polling stopped");
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
