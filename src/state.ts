import * as vscode from 'vscode';

const DISMISS_COUNTS_KEY = 'dismissCounts';
const SNOOZE_UNTIL_KEY = 'snoozeUntil';
const ORIGINAL_COLORS_KEY = 'originalColorCustomizations';
const ORIGINAL_THEME_KEY = 'originalColorTheme';

let globalState: vscode.Memento;

export function initState(state: vscode.Memento): void {
  globalState = state;
}

// --- Dismiss counts ---

function getDismissCounts(): Record<string, number> {
  return globalState.get<Record<string, number>>(DISMISS_COUNTS_KEY, {});
}

export function getDismissCount(prId: string): number {
  return getDismissCounts()[prId] ?? 0;
}

export async function incrementDismiss(prId: string): Promise<void> {
  const counts = getDismissCounts();
  counts[prId] = (counts[prId] ?? 0) + 1;
  await globalState.update(DISMISS_COUNTS_KEY, counts);
}

export async function resetDismiss(prId: string): Promise<void> {
  const counts = getDismissCounts();
  delete counts[prId];
  await globalState.update(DISMISS_COUNTS_KEY, counts);
}

export async function resetAllDismissCounts(): Promise<void> {
  await globalState.update(DISMISS_COUNTS_KEY, {});
}

export async function cleanupStale(currentPrIds: Set<string>): Promise<void> {
  const counts = getDismissCounts();
  const cleaned: Record<string, number> = {};
  for (const [id, count] of Object.entries(counts)) {
    if (currentPrIds.has(id)) {
      cleaned[id] = count;
    }
  }
  await globalState.update(DISMISS_COUNTS_KEY, cleaned);
}

// --- Snooze ---

export function isSnoozing(): boolean {
  const until = globalState.get<number>(SNOOZE_UNTIL_KEY, 0);
  return Date.now() < until;
}

export async function setSnooze(durationMinutes: number): Promise<void> {
  const until = Date.now() + durationMinutes * 60 * 1000;
  await globalState.update(SNOOZE_UNTIL_KEY, until);
}

export async function clearSnooze(): Promise<void> {
  await globalState.update(SNOOZE_UNTIL_KEY, 0);
}

// --- Original workbench state (for restore) ---

export async function saveOriginalColors(): Promise<void> {
  const current = vscode.workspace
    .getConfiguration('workbench')
    .get('colorCustomizations');
  const alreadySaved = globalState.get(ORIGINAL_COLORS_KEY);
  if (!alreadySaved) {
    await globalState.update(ORIGINAL_COLORS_KEY, current ?? {});
  }
}

export async function restoreOriginalColors(): Promise<void> {
  const original = globalState.get<Record<string, string>>(
    ORIGINAL_COLORS_KEY
  );
  if (original !== undefined) {
    await vscode.workspace
      .getConfiguration('workbench')
      .update(
        'colorCustomizations',
        Object.keys(original).length > 0 ? original : undefined,
        vscode.ConfigurationTarget.Global
      );
    await globalState.update(ORIGINAL_COLORS_KEY, undefined);
  }
}

export async function saveOriginalTheme(): Promise<void> {
  const current = vscode.workspace
    .getConfiguration('workbench')
    .get<string>('colorTheme');
  const alreadySaved = globalState.get(ORIGINAL_THEME_KEY);
  if (!alreadySaved && current) {
    await globalState.update(ORIGINAL_THEME_KEY, current);
  }
}

export async function restoreOriginalTheme(): Promise<void> {
  const original = globalState.get<string>(ORIGINAL_THEME_KEY);
  if (original) {
    await vscode.workspace
      .getConfiguration('workbench')
      .update('colorTheme', original, vscode.ConfigurationTarget.Global);
    await globalState.update(ORIGINAL_THEME_KEY, undefined);
  }
}

export function getMaxLevel(dismissCount: number, maxAllowed: number): number {
  return Math.min(dismissCount, maxAllowed);
}
