# Annoying Review Reminder

A VS Code extension that **brutally reminds** you about pending GitHub PR reviews — with escalating levels of annoyance.

Your teammates are waiting. Stop ignoring those review requests.

## Features

### 🎚️ 6 Brutality Levels

Each time your level grace period of your reminder is reached, the next one gets **worse**:

| Level | Name | What Happens |
|-------|------|-------------|
| 0 | **Gentle** | Status bar badge + friendly info notification |
| 1 | **Nudge** | Warning notification with PR list |
| 2 | **Pushy** | **Modal dialog** (blocks everything) + editor turns **red** |
| 3 | **Intrusive** | Random text document pops up with review list + **sound alert** |
| 4 | **Aggressive** | Full-screen flashing webview + alarm sound + workbench color cycling |
| 5 | **Nuclear** | ⚠️ NOT RECOMMENDED - ⚡ FLASH WARNING - Continuously self opening flashing panels + theme cycling + document spam. **Only escape: "I Promise to Review!" command**. IF YOU DON'T REACT, YOUR WINDOW MIGHT HANG |

### 🔗 GitHub Integration

- Authenticates via VS Code's built-in GitHub auth
- Fetches PRs where you are a **requested reviewer**
- Configurable repository filter

### ⚙️ Configurable

- **Poll interval** — how often to check (default: 5 minutes)
- **Max brutality level** — cap the maximum chaos level (0–5)
- **Snooze duration** — temporary relief (default: 30 minutes)
- **Repository filter** — select which repos to watch

### 😴 Auto-Pause Detection

The extension gets paused if VS Code is not focussed and you are not actively coding.
You maybe wonder why but imagine leaving VS Code open over night while the extension is doing its thing. 9/10 wouldn't recommend.

## Commands

| Command | Description |
|---------|-------------|
| `Review Reminder: Refresh Pending Reviews` | Manually refreshes pending reviews |
| `Review Reminder: Show Pending Reviews` | Shows a list of open PRs you are requested as reviewer |
| `Review Reminder: Pause / Resume Reminders` | Pauses or resumes the reminder mechanism |
| `Review Reminder: Snooze All Reminders` | Snooze for the configured duration |
| `Review Reminder: Reset Escalation & Restore Colors` | Reset all escalation and fix any visual effects |
| `Review Reminder: Select Repositories to Watch` | Pick repos from your GitHub account |
| `Review Reminder: I Promise to Review! (Stop Nuclear)` | Nuclear escape hatch - resets everything with a 10-minute grace period |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `annoyingReviewReminder.enabled` | `true` | Enable/disable the extension |
| `annoyingReviewReminder.repos` | `[]` | Repos to watch (`["owner/repo"]`). Empty = all |
| `annoyingReviewReminder.pollIntervalSeconds` | `300` | Poll interval in seconds. If snoozeDurationMinutes is reached with current poll, reminder gets triggert. |
| `annoyingReviewReminder.maxBrutalityLevel` | `4` | Max escalation level (0–5) |
| `annoyingReviewReminder.snoozeDurationMinutes` | `30` | Min. duration between reminders in minutes. Also defines duration for increasing escalation level. |
| `annoyingReviewReminder.lessRelevantReviewLabels` | `['dependency']` | Set of labels that mark PRs as "less relevant" (shown in list and count in menu bar but excluded from reminder) |
| `annoyingReviewReminder.includeDraftReviews` | `false` | When `true`, include draft PRs as less relevant items (shown in list and count in menu bar but excluded from reminder) |
| `annoyingReviewReminder.pauseWhenIdle` | `true` | Pauses extension when window gets idle |

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
