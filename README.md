# Annoying Review Reminder

A VS Code extension that **brutally reminds** you about pending GitHub PR reviews — with escalating levels of annoyance.

Your teammates are waiting. Stop ignoring those review requests.

## Features

### 🎚️ 6 Brutality Levels

Each time you dismiss a reminder, the next one gets **worse**:

| Level | Name | What Happens |
|-------|------|-------------|
| 0 | **Gentle** | Status bar badge + friendly info notification |
| 1 | **Nudge** | Warning notification with PR list |
| 2 | **Pushy** | **Modal dialog** (blocks everything) + editor turns **red** |
| 3 | **Intrusive** | Random text document pops up with review list + **sound alert** |
| 4 | **Aggressive** | Full-screen flashing webview + alarm sound + workbench color cycling |
| 5 | **Nuclear** | Multiple flashing panels + theme cycling + document spam. **Only escape: "I Promise to Review!" command** |

### 🔗 GitHub Integration

- Authenticates via VS Code's built-in GitHub auth
- Fetches PRs where you are a **requested reviewer**
- Configurable repository filter

### ⚙️ Configurable

- **Poll interval** — how often to check (default: 5 minutes)
- **Max brutality level** — cap the maximum chaos level (0–5)
- **Snooze duration** — temporary relief (default: 30 minutes)
- **Repository filter** — select which repos to watch

## Commands

| Command | Description |
|---------|-------------|
| `Review Reminder: Refresh Pending Reviews` | Manually check for pending reviews |
| `Review Reminder: Snooze All Reminders` | Snooze for the configured duration |
| `Review Reminder: Reset Escalation & Restore Colors` | Reset all escalation and fix any visual effects |
| `Review Reminder: Select Repositories to Watch` | Pick repos from your GitHub account |
| `Review Reminder: I Promise to Review! (Stop Nuclear)` | Nuclear escape hatch — resets everything with a 10-minute grace period |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `annoyingReviewReminder.enabled` | `true` | Enable/disable the extension |
| `annoyingReviewReminder.repos` | `[]` | Repos to watch (`["owner/repo"]`). Empty = all |
| `annoyingReviewReminder.pollIntervalSeconds` | `300` | Check interval in seconds |
| `annoyingReviewReminder.maxBrutalityLevel` | `5` | Max escalation level (0–5) |
| `annoyingReviewReminder.snoozeDurationMinutes` | `30` | Snooze duration in minutes |

## Getting Started

1. Install the extension
2. It will ask you to sign in to GitHub on first use
3. (Optional) Run **"Select Repositories to Watch"** to filter repos
4. Reviews will be checked automatically — don't ignore them!

## Safety

- **Reset Escalation** command always restores your editor to normal
- Colors and themes are saved before modification and restored on snooze/action
- Extension cleanup runs on deactivate

## Development

```bash
npm install
npm run watch    # Start watching for changes
# Press F5 to launch Extension Development Host
```

## License

MIT
