import { PendingReview } from '../types';
import { getGitHubSession } from './auth';
import { getConfig } from '../config';

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubSearchItem[];
}

interface GitHubSearchItem {
  id: number;
  number: number;
  title: string;
  html_url: string;
  user: { login: string };
  created_at: string;
  repository_url: string;
  pull_request?: { html_url: string };
}

function repoFromUrl(repositoryUrl: string): string {
  // repositoryUrl looks like "https://api.github.com/repos/owner/repo"
  const parts = repositoryUrl.split('/');
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

interface GitHubPullResponse {
  additions: number;
  deletions: number;
}

async function fetchPrStats(
  repo: string,
  prNumber: number,
  accessToken: string
): Promise<{ additions: number; deletions: number }> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );
    if (!response.ok) {
      return { additions: 0, deletions: 0 };
    }
    const data = (await response.json()) as GitHubPullResponse;
    return { additions: data.additions, deletions: data.deletions };
  } catch {
    return { additions: 0, deletions: 0 };
  }
}

export async function fetchPendingReviews(): Promise<PendingReview[]> {
  const session = await getGitHubSession(false);
  const config = getConfig();

  const repoFilters = config.repos;
  let query = 'is:open is:pr review-requested:@me draft:false';

  if (repoFilters.length === 1) {
    query += ` repo:${repoFilters[0]}`;
  }

  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=100&sort=created&order=desc`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    if (rateLimitRemaining === '0') {
      const resetTime = response.headers.get('X-RateLimit-Reset');
      const resetDate = resetTime
        ? new Date(parseInt(resetTime) * 1000)
        : undefined;
      throw new Error(
        `GitHub API rate limit exceeded. Resets at ${resetDate?.toLocaleTimeString() ?? 'unknown'}.`
      );
    }
    throw new Error(`GitHub API returned 403: ${await response.text()}`);
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API returned ${response.status}: ${await response.text()}`
    );
  }

  const data = (await response.json()) as GitHubSearchResponse;

  const basicReviews = data.items.map((item) => ({
    id: `${item.id}`,
    number: item.number,
    title: item.title,
    url: item.pull_request?.html_url ?? item.html_url,
    repo: repoFromUrl(item.repository_url),
    author: item.user.login,
    createdAt: item.created_at,
  }));

  // Client-side filter when multiple repos are configured
  let filtered = basicReviews;
  if (repoFilters.length > 1) {
    const repoSet = new Set(repoFilters.map((r) => r.toLowerCase()));
    filtered = filtered.filter((r) => repoSet.has(r.repo.toLowerCase()));
  }

  // Fetch additions/deletions stats for each PR
  const statsPromises = filtered.map((r) =>
    fetchPrStats(r.repo, r.number, session.accessToken)
  );
  const stats = await Promise.all(statsPromises);

  const reviews: PendingReview[] = filtered.map((r, i) => ({
    ...r,
    additions: stats[i].additions,
    deletions: stats[i].deletions,
  }));

  return reviews;
}
