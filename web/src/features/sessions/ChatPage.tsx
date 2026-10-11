import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import type { PromptRequest } from "@hub/shared";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Spinner } from "../../components/ui/Spinner";
import { api, errorMessage } from "../../lib/api";
import { formatModel, formatTokens, formatUsd, isoMs } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { useSessionEvents } from "../../lib/sse";
import { asModelList, type MessageDto, type MessagePart, type SessionDto } from "../../lib/types";

const PENDING_WINDOW_MS = 90_000;

/* ---------- tool part state (defensive) ---------- */

const TOOL_DONE = new Set(["success", "completed", "done", "ok"]);
const TOOL_FAIL = new Set(["error", "failed", "aborted", "canceled", "cancelled"]);

/** Local models sometimes leak raw <think>...</think> blocks into text parts — hide them. */
function stripThink(text: string): string {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<\/?think>/gi, "");
  return stripped.trimStart();
}

function toolStateLabel(state: unknown): string {
  if (typeof state === "object" && state !== null) {
    const rec = state as Record<string, unknown>;
    const status = rec.status;
    if (typeof status === "string" && status.length > 0) return status;
    if (rec.error != null) return "error";
  }
  return "running";
}

function toolGlyph(label: string): string {
  if (TOOL_DONE.has(label)) return "✓";
  if (TOOL_FAIL.has(label)) return "✗";
  return "...";
}

function toolTone(label: string): "accent" | "red" | "neutral" {
  if (TOOL_DONE.has(label)) return "accent";
  if (TOOL_FAIL.has(label)) return "red";
  return "neutral";
}

/* ---------- message rendering ---------- */

function PartView({ part }: { part: MessagePart }) {
  if (part.type === "text") {
    return (
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">
        {stripThink(part.text ?? "")}
      </div>
    );
  }
  if (part.type === "reasoning") {
    return (
      <details className="rounded-lg border border-line bg-bg/60 px-3 py-2">
        <summary className="cursor-pointer select-none text-[11px] font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
          Thinking
        </summary>
        <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-500">
          {part.text != null && part.text.length > 0 ? part.text : "(no reasoning content)"}
        </div>
      </details>
    );
  }
  if (part.type === "tool") {
    const label = toolStateLabel(part.state);
    return (
      <span className="inline-flex items-center gap-2">
        <Badge tone={toolTone(label)}>
          {toolGlyph(label)} {part.name != null && part.name.length > 0 ? part.name : "tool"}
        </Badge>
        {typeof part.id === "string" && part.id.length > 0 ? (
          <span className="font-mono text-[10px] text-zinc-600">{part.id.slice(0, 8)}</span>
        ) : null}
      </span>
    );
  }
  return <Badge>{part.type != null && part.type.length > 0 ? part.type : "part"}</Badge>;
}

function MessageRow({ m }: { m: MessageDto }) {
  // Real shape: user text at top level; assistant parts under `content`.
  const parts = m.type === "user" && m.content == null && m.text != null
    ? [{ type: "text", text: m.text } as MessagePart]
    : m.content ?? m.parts ?? [];

  if (m.type === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-2 rounded-2xl rounded-br-sm border border-line bg-surface-2 px-4 py-2.5">
          {parts.length === 0 ? (
            <span className="text-sm italic text-zinc-600">(empty)</span>
          ) : (
            parts.map((p, i) => <PartView key={i} part={p} />)
          )}
        </div>
      </div>
    );
  }

  const model = formatModel(m.model);
  const inTok = m.tokens?.input;
  const outTok = m.tokens?.output;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500">
        {model !== "—" ? <span className="text-violet-300/80">{model}</span> : null}
        {typeof inTok === "number" ? <span>in {formatTokens(inTok)}</span> : null}
        {typeof outTok === "number" ? <span>out {formatTokens(outTok)}</span> : null}
        {typeof m.cost === "number" ? <span>{formatUsd(m.cost)}</span> : null}
      </div>
      {parts.length === 0 ? (
        <div className="text-sm italic text-zinc-600">(no content)</div>
      ) : (
        <div className="space-y-2">
          {parts.map((p, i) => (
            <PartView key={i} part={p} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- page ---------- */

export function ChatPage() {
  const { id } = useParams();
  const sessionId = typeof id === "string" ? id : "";
  const qc = useQueryClient();
  const navigate = useNavigate();

  const messagesQ = useQuery({
    enabled: sessionId.length > 0,
    queryKey: queryKeys.sessions.messages(sessionId),
    queryFn: () =>
      api<{ data?: MessageDto[] }>(
        `/api/sessions/${encodeURIComponent(sessionId)}/messages?limit=200`,
      ),
  });

  const modelsQ = useQuery({
    queryKey: queryKeys.models,
    queryFn: () => api<unknown>("/api/models"),
  });

  const modelOptions = useMemo(() => asModelList(modelsQ.data), [modelsQ.data]);

  // Best-effort session metadata from the cached list — the contract has no
  // GET /api/sessions/:id, so we never fetch a detail endpoint here.
  const cachedList = qc.getQueryData<{ data?: SessionDto[] }>(queryKeys.sessions.list(100));
  const meta = cachedList?.data?.find((s) => s.id === sessionId);

  useSessionEvents(sessionId, () => {
    void qc.invalidateQueries({ queryKey: queryKeys.sessions.messages(sessionId) });
  });

  const messages = useMemo(
    () => (messagesQ.data?.data ?? []).filter((m) => m.type === "user" || m.type === "assistant"),
    [messagesQ.data],
  );

  /* ----- UI state (never server data) ----- */
  const [text, setText] = useState("");
  const [modelChoice, setModelChoice] = useState("");
  const [sentAt, setSentAt] = useState<number | null>(null);

  // Derive "assistant is working" from the transcript: no assistant message
  // after the last user message, or the latest one lacks time.completed.
  const assistantPending = useMemo(() => {
    if (messages.length === 0) return false;
    let lastUser = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.type === "user") {
        lastUser = i;
        break;
      }
    }
    if (lastUser === -1) return false;
    for (let i = messages.length - 1; i > lastUser; i -= 1) {
      const m = messages[i];
      if (m?.type === "assistant") {
        return m.time?.completed == null && m.time?.streamed == null;
      }
    }
    return true;
  }, [messages]);

  // 90s safety timeout — never wait forever on a dropped SSE frame.
  useEffect(() => {
    if (sentAt == null) return;
    const t = window.setTimeout(() => setSentAt(null), PENDING_WINDOW_MS);
    return () => window.clearTimeout(t);
  }, [sentAt]);

  // A finished assistant message in the transcript clears the send override.
  useEffect(() => {
    if (!assistantPending) setSentAt(null);
  }, [assistantPending]);

  const last = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const lastActivityMs = Math.max(
    isoMs(last?.time?.completed),
    isoMs(last?.time?.streamed),
    isoMs(last?.time?.created),
  );
  const pending = sentAt != null || (assistantPending && Date.now() - lastActivityMs < PENDING_WINDOW_MS);

  /* ----- mutations ----- */
  const send = useMutation({
    mutationFn: (body: PromptRequest) =>
      api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}/prompt`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setSentAt(Date.now());
      setText("");
      void qc.invalidateQueries({ queryKey: queryKeys.sessions.messages(sessionId) });
    },
  });

  const interrupt = useMutation({
    mutationFn: () =>
      api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}/interrupt`, { method: "POST" }),
    onSuccess: () => {
      setSentAt(null);
      void qc.invalidateQueries({ queryKey: queryKeys.sessions.messages(sessionId) });
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
      navigate("/sessions");
    },
  });

  /* ----- handlers ----- */
  function trySend() {
    const trimmed = text.trim();
    if (trimmed.length === 0 || pending || send.isPending || sessionId.length === 0) return;
    const body: PromptRequest = { text: trimmed };
    if (modelChoice.length > 0) body.model = modelChoice;
    send.mutate(body);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      trySend();
    }
  }

  function handleDelete() {
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    remove.mutate();
  }

  // Auto-scroll to bottom on new content, but respect a user that scrolled up.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  function handleScroll() {
    const el = scrollRef.current;
    if (el == null) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el != null && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const lastModel = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m?.model != null) return m.model;
    }
    return undefined;
  }, [messages]);

  const headerModel = meta?.model ?? lastModel;
  const title = meta?.title != null && meta.title.length > 0 ? meta.title : "Session";

  if (sessionId.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-4 lg:p-6">
        <ErrorState message="Missing session id" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 lg:px-6">
        <Link
          to="/sessions"
          className="shrink-0 rounded-md border border-line px-2 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
        >
          ← Sessions
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-100">{title}</div>
          <div className="truncate font-mono text-[11px] text-zinc-600">{sessionId}</div>
        </div>
        {headerModel != null ? (
          <Badge tone="violet" className="hidden sm:inline-flex">
            {formatModel(headerModel)}
          </Badge>
        ) : null}
        <button
          type="button"
          onClick={handleDelete}
          disabled={remove.isPending}
          className="shrink-0 rounded-md border border-red-900/60 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
        >
          {remove.isPending ? "Deleting..." : "Delete"}
        </button>
      </header>

      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-5">
          {messagesQ.isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner className="h-6 w-6" />
            </div>
          ) : messagesQ.isError ? (
            <ErrorState
              message={errorMessage(messagesQ.error)}
              onRetry={() => void messagesQ.refetch()}
            />
          ) : messages.length === 0 ? (
            <EmptyState
              title="No messages yet"
              hint="Send a prompt below to start the conversation."
            />
          ) : (
            messages.map((m, i) => <MessageRow key={m.id ?? i} m={m} />)
          )}
          {pending ? (
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <Spinner className="h-3 w-3" />
              waiting for assistant...
            </div>
          ) : null}
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface/40 px-4 py-3 lg:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={Math.min(8, Math.max(1, text.split("\n").length))}
              spellCheck={false}
              placeholder={pending ? "Assistant is working..." : "Send a message"}
              className="min-h-[2.4rem] flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none"
            />
            {pending ? (
              <button
                type="button"
                onClick={() => interrupt.mutate()}
                disabled={interrupt.isPending}
                className="rounded-xl border border-amber-700/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
              >
                {interrupt.isPending ? "Stopping..." : "Interrupt"}
              </button>
            ) : (
              <button
                type="button"
                onClick={trySend}
                disabled={text.trim().length === 0 || send.isPending}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
              >
                {send.isPending ? "Sending..." : "Send"}
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={modelChoice}
              onChange={(e) => setModelChoice(e.target.value)}
              className="rounded-lg border border-line bg-bg px-2 py-1 font-mono text-xs text-zinc-300 focus:border-emerald-500/60 focus:outline-none"
            >
              <option value="">session default model</option>
              {modelOptions.map((mo) => (
                <option key={mo} value={mo}>
                  {mo}
                </option>
              ))}
            </select>
            {send.isError || interrupt.isError ? (
              <span className="text-xs text-red-400">
                {errorMessage(send.error ?? interrupt.error)}
              </span>
            ) : null}
            <span className="ml-auto font-mono text-[10px] text-zinc-600">Ctrl/⌘+Enter to send</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
