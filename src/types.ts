export interface PendingReview {
  id: string;
  number: number;
  title: string;
  url: string;
  repo: string;
  author: string;
  createdAt: string;
  additions: number;
  deletions: number;
}

export type ReminderAction = 'dismissed' | 'opened' | 'snoozed';

export interface ReminderLevel {
  readonly name: string;
  execute(
    reviews: PendingReview[],
    context: import('vscode').ExtensionContext
  ): Promise<ReminderAction>;
  cleanup?(): void;
}
