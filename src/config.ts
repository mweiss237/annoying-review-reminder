import * as vscode from 'vscode';

export interface ExtensionConfig {
  repos: string[];
  pollIntervalSeconds: number;
  maxBrutalityLevel: number;
  snoozeDurationMinutes: number;
  lessRelevantReviewLabels: string[];
  includeDraftReviews: boolean;
  enabled: boolean;
  pauseWhenIdle: boolean;
}

export function getConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration('annoyingReviewReminder');
  return {
    repos: cfg.get<string[]>('repos', []),
    pollIntervalSeconds: cfg.get<number>('pollIntervalSeconds', 300),
    maxBrutalityLevel: cfg.get<number>('maxBrutalityLevel', 5),
    snoozeDurationMinutes: cfg.get<number>('snoozeDurationMinutes', 30),
    lessRelevantReviewLabels: cfg.get<string[]>('lessRelevantReviewLabels', ['dependency']),
    includeDraftReviews: cfg.get<boolean>('includeDraftReviews', false),
    enabled: cfg.get<boolean>('enabled', true),
    pauseWhenIdle: cfg.get<boolean>('pauseWhenIdle', true),
  };
}
