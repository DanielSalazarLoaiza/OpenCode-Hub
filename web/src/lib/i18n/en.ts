/**
 * English dictionary — SOURCE OF TRUTH for the Messages shape.
 * Every key here must exist in es.ts (TypeScript enforces parity).
 * Product name stays "OpenCode Hub" in both languages.
 */
export const en = {
  /* app */
  "app.name": "OpenCode Hub",

  /* navigation */
  "nav.dashboard": "Dashboard",
  "nav.sessions": "Sessions",
  "nav.commands": "Commands",
  "nav.aria": "Main navigation",

  /* sidebar */
  "sidebar.version": "v2",

  /* common */
  "common.retry": "Retry",
  "common.delete": "Delete",
  "common.deleting": "Deleting...",
  "common.loading": "Loading...",
  "common.untitled": "Untitled",

  /* topbar */
  "topbar.connected": "Connected",
  "topbar.offline": "Offline",
  "topbar.checking": "Checking...",
  "topbar.version": "OpenCode v{version}",
  "topbar.themeToggle": "Toggle theme",
  "topbar.languageToggle": "Language",

  /* dashboard */
  "dashboard.subtitle.range": "Last 12 months",
  "dashboard.subtitle.updated": "updated {relative}",
  "dashboard.stats.tokens": "Tokens",
  "dashboard.stats.cost": "Est. cost",
  "dashboard.stats.sessions": "Sessions",
  "dashboard.stats.prompts": "Prompts",
  "dashboard.stats.activeDays": "Active days",
  "dashboard.stats.streak": "Streak",
  "dashboard.stats.streakUnit": "d",
  "dashboard.stats.inOut": "in {input} · out {output}",
  "dashboard.stats.usd": "USD",
  "dashboard.chart.title": "Usage by month",
  "dashboard.chart.tokens": "tokens",
  "dashboard.chart.cost": "cost (USD)",
  "dashboard.chart.noCost": "No cost reported by upstream models.",
  "dashboard.chart.empty": "No usage recorded yet",
  "dashboard.models.title": "Models by usage",
  "dashboard.models.model": "Model",
  "dashboard.models.steps": "Steps",
  "dashboard.models.tokens": "Tokens",
  "dashboard.models.cost": "Cost",
  "dashboard.models.share": "{share}% of tokens",
  "dashboard.models.empty": "No model usage recorded",
  "dashboard.activity.title": "Activity",
  "dashboard.activity.total": "{steps} steps · 90d",
  "dashboard.activity.today": "today",
  "dashboard.activity.day": "{date} · {steps} steps",
  "dashboard.recent.title": "Recent sessions",
  "dashboard.recent.viewAll": "View all",
  "dashboard.recent.empty": "No sessions yet",
  "dashboard.recent.emptyHint": "Sessions appear here once you chat.",

  /* sessions */
  "sessions.count": "{shown} of {total} sessions",
  "sessions.filter": "Filter title / id / model...",
  "sessions.new": "New session",
  "sessions.creating": "Creating...",
  "sessions.col.title": "Title",
  "sessions.col.model": "Model",
  "sessions.col.tokens": "Tokens",
  "sessions.col.cost": "Cost",
  "sessions.col.created": "Created",
  "sessions.confirmDelete": 'Delete session "{label}"? This cannot be undone.',
  "sessions.empty.filterTitle": "No sessions match the filter",
  "sessions.empty.filterHint": "Try a different search term.",
  "sessions.empty.title": "No sessions yet",
  "sessions.empty.hint": "Create one to get started.",

  /* chat */
  "chat.back": "Sessions",
  "chat.defaultTitle": "Session",
  "chat.missingId": "Missing session id",
  "chat.confirmDelete": "Delete this session? This cannot be undone.",
  "chat.empty.title": "No messages yet",
  "chat.empty.hint": "Send a prompt below to start the conversation.",
  "chat.reasoning": "Thinking",
  "chat.reasoning.empty": "(no reasoning content)",
  "chat.tool.default": "tool",
  "chat.part.default": "part",
  "chat.user.empty": "(empty)",
  "chat.assistant.empty": "(no content)",
  "chat.meta.in": "in {tokens}",
  "chat.meta.out": "out {tokens}",
  "chat.placeholder": "Send a message",
  "chat.placeholderPending": "Assistant is working...",
  "chat.send": "Send",
  "chat.sending": "Sending...",
  "chat.interrupt": "Interrupt",
  "chat.interruptHint": "Esc",
  "chat.interrupting": "Stopping...",
  "chat.waiting": "waiting for assistant...",
  "chat.model.default": "session default model",
  "chat.ctrlEnter": "Ctrl/⌘+Enter to send",

  /* commands */
  "commands.count": "{count} slash commands available",
  "commands.filter": "Filter commands...",
  "commands.source.global": "global",
  "commands.source.project": "project",
  "commands.agent": "agent: {agent}",
  "commands.showLess": "Show less",
  "commands.showAll": "Show all {count} lines",
  "commands.empty.filterTitle": "No commands match the filter",
  "commands.empty.filterHint": "Try a different search term.",
  "commands.empty.title": "No commands registered",
  "commands.empty.hint":
    "SDD commands (sdd-init, sdd-propose, ...) appear here once synced from opencode.",
};
