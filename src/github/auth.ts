import * as vscode from 'vscode';

let currentSession: vscode.AuthenticationSession | undefined;

export async function getGitHubSession(
  interactive: boolean = false
): Promise<vscode.AuthenticationSession> {
  const session = await vscode.authentication.getSession('github', ['repo'], {
    createIfNone: interactive,
    silent: !interactive,
  });

  if (!session) {
    throw new Error(
      'GitHub authentication required. Please sign in to GitHub.'
    );
  }

  currentSession = session;
  return session;
}

export function getCachedSession(): vscode.AuthenticationSession | undefined {
  return currentSession;
}
