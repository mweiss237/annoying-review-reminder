import * as vscode from 'vscode';

const BRUTALITY_LEVELS_KEY = 'brutalityLevels';
const LEVEL_UP_TIMES_KEY = 'levelUpTimes';
const SNOOZE_UNTIL_KEY = 'snoozeUntil';
const ORIGINAL_COLORS_KEY = 'originalColorCustomizations';
const ORIGINAL_THEME_KEY = 'originalColorTheme';

let globalState: vscode.Memento;

export function initState(state: vscode.Memento): void {
  globalState = state;
}

// --- Per-PR Brutality Levels (time-based escalation) ---

function getBrutalityLevels(): Record<string, number> {
  return globalState.get<Record<string, number>>(BRUTALITY_LEVELS_KEY, {});
}

export function getBrutalityLevel(prId: string): number {
  return getBrutalityLevels()[prId] ?? 0;
}

export async function setBrutalityLevel(prId: string, level: number): Promise<void> {
  const levels = getBrutalityLevels();
  levels[prId] = level;
  await globalState.update(BRUTALITY_LEVELS_KEY, levels);
}

export async function incrementBrutalityLevel(prId: string, maxLevel: number): Promise<void> {
  const levels = getBrutalityLevels();
  const current = levels[prId] ?? 0;
  const newLevel = Math.min(current + 1, maxLevel);
  levels[prId] = newLevel;
  await globalState.update(BRUTALITY_LEVELS_KEY, levels);
}

export async function resetBrutalityLevel(prId: string): Promise<void> {
  const levels = getBrutalityLevels();
  delete levels[prId];
  await globalState.update(BRUTALITY_LEVELS_KEY, levels);
}

export async function resetAllBrutalityLevels(): Promise<void> {
  await globalState.update(BRUTALITY_LEVELS_KEY, {});
  await globalState.update(LEVEL_UP_TIMES_KEY, {});
}

export async function cleanupStale(currentPrIds: Set<string>): Promise<void> {
  const levels = getBrutalityLevels();
  const cleanedLevels: Record<string, number> = {};
  for (const [id, level] of Object.entries(levels)) {
    if (currentPrIds.has(id)) {
      cleanedLevels[id] = level;
    }
  }
  await globalState.update(BRUTALITY_LEVELS_KEY, cleanedLevels);

  const levelUpTimes = getLevelUpTimes();
  const cleanedTimes: Record<string, number> = {};
  for (const [id, time] of Object.entries(levelUpTimes)) {
    if (currentPrIds.has(id)) {
      cleanedTimes[id] = time;
    }
  }
  await globalState.update(LEVEL_UP_TIMES_KEY, cleanedTimes);
}

// --- Level-up timestamps (track when each PR was last escalated) ---

function getLevelUpTimes(): Record<string, number> {
  return globalState.get<Record<string, number>>(LEVEL_UP_TIMES_KEY, {});
}

export function getLevelUpTime(prId: string): number | undefined {
  return getLevelUpTimes()[prId];
}

export async function setLevelUpTime(prId: string, time: number): Promise<void> {
  const times = getLevelUpTimes();
  times[prId] = time;
  await globalState.update(LEVEL_UP_TIMES_KEY, times);
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
