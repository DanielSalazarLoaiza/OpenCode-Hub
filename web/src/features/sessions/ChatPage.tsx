import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import type { PromptRequest } from "@hub/shared";
import { ArrowLeft, MessageProgramming, Send2, Trash } from "iconsax-react";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Icon } from "../../components/ui/Icon";
import { api, errorMessage } from "../../lib/api";
import { confirmAction } from "../../lib/confirm";
import { formatModel, formatTokens, formatUsd, isoMs } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { useSessionEvents } from "../../lib/sse";
import { useI18n } from "../../lib/i18n";
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

function toolTone(label: string): "ok" | "err" | "neutral" {
  if (TOOL_DONE.has(label)) return "ok";
  if (TOOL_FAIL.has(label)) return "err";
  return "neutral";
}

/* ---------- message rendering ---------- */

function PartView({ part }: { part: MessagePart }) {
  const { t } = useI18n();

  if (part.type === "text") {
    return (
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-primary">
        {stripThink(part.text ?? "")}
      </div>
    );
  }
  if (part.type === "reasoning") {
    return (
      <details className="rounded-lg border border-line bg-surface-3/50 px-3 py-2">
        <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-secondary">
          {t("chat.reasoning")}
        </summary>
        <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">
          {part.text != null && part.text.length > 0 ? part.text : t("chat.reasoning.empty")}
        </div>
      </details>
    );
  }
  if (part.type === "tool") {
    const label = toolStateLabel(part.state);
    return (
      <span className="inline-flex items-center gap-2">
        <Badge tone={toolTone(label)}>
          {toolGlyph(label)} {part.name != null && part.name.length > 0 ? part.name : t("chat.tool.default")}
        </Badge>
        {typeof part.id === "string" && part.id.length > 0 ? (
          <span className="font-mono text-[10px] text-muted">{part.id.slice(0, 8)}</span>
        ) : null}
      </span>
    );
  }
  return <Badge>{part.type != null && part.type.length > 0 ? part.type : t("chat.part.default")}</Badge>;
}

function MessageRow({ m }: { m: MessageDto }) {
  const { t, locale } = useI18n();
  // Real shape: user text at top level; assistant parts under `content`.
  const parts = m.type === "user" && m.content == null && m.text != null
    ? [{ type: "text", text: m.text } as MessagePart]
    : m.content ?? m.parts ?? [];

  if (m.type === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-2 rounded-2xl rounded-br-sm border border-accent-border bg-accent-soft px-4 py-2.5">
          {parts.length === 0 ? (
            <span className="text-sm italic text-muted">{t("chat.user.empty")}</span>
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
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
        {model !== "—" ? <Badge tone="accent">{model}</Badge> : null}
        {typeof inTok === "number" ? <span>{t("chat.meta.in", { tokens: formatTokens(inTok, locale) })}</span> : null}
        {typeof outTok === "number" ? <span>{t("chat.meta.out", { tokens: formatTokens(outTok, locale) })}</span> : null}
        {typeof m.cost === "number" ? <span>{formatUsd(m.cost, locale)}</span> : null}
      </div>
      {parts.length === 0 ? (
        <div className="text-sm italic text-muted">{t("chat.assistant.empty")}</div>
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
  const { t } = useI18n();
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
    const timer = window.setTimeout(() => setSentAt(null), PENDING_WINDOW_MS);
    return () => window.clearTimeout(timer);
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

  const interruptMutate = interrupt.mutate;
  const interruptBusy = interrupt.isPending;

  // Esc interrupts while pending (brand voice: «Interrumpir»).
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !interruptBusy) interruptMutate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, interruptBusy, interruptMutate]);

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
    if (!confirmAction(t("chat.confirmDelete"))) return;
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
  const title = meta?.title != null && meta.title.length > 0 ? meta.title : t("chat.defaultTitle");

  if (sessionId.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-4 lg:p-6">
        <ErrorState message={t("chat.missingId")} retryLabel={t("common.retry")} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface-2/40 px-4 py-3 lg:px-6">
        <Link
          to="/sessions"
          aria-label={t("chat.back")}
          title={t("chat.back")}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-secondary hover:bg-surface-3 hover:text-primary"
        >
          <Icon icon={ArrowLeft} size={16} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-bold text-primary">{title}</div>
          <div className="truncate font-mono text-[11px] text-muted">{sessionId}</div>
        </div>
        {headerModel != null ? (
          <Badge tone="accent" className="hidden sm:inline-flex">
            {formatModel(headerModel)}
          </Badge>
        ) : null}
        <button
          type="button"
          onClick={handleDelete}
          disabled={remove.isPending}
          aria-label={t("common.delete")}
          title={t("common.delete")}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-err/30 text-err hover:bg-err-soft disabled:opacity-40"
        >
          <Icon icon={Trash} size={16} />
        </button>
      </header>

      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-5">
          {messagesQ.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={`hub-skeleton h-16 ${i % 2 === 0 ? "ml-auto w-2/3" : "w-full"}`} />
              ))}
            </div>
          ) : messagesQ.isError ? (
            <ErrorState
              message={errorMessage(messagesQ.error)}
              retryLabel={t("common.retry")}
              onRetry={() => void messagesQ.refetch()}
            />
          ) : messages.length === 0 ? (
            <EmptyState
              icon={<Icon icon={MessageProgramming} size={22} />}
              title={t("chat.empty.title")}
              hint={`${t("chat.empty.hint")} ${t("chat.ctrlEnter")}`}
            />
          ) : (
            messages.map((m, i) => <MessageRow key={m.id ?? i} m={m} />)
          )}
          {pending ? (
            <div className="flex items-center gap-2.5 text-xs text-accent">
              <span className="hub-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              {t("chat.waiting")}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface-2/60 px-4 py-3 lg:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-xl border border-line bg-surface-2 p-2 shadow-sm focus-within:border-accent-border">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={Math.min(8, Math.max(1, text.split("\n").length))}
              spellCheck={false}
              placeholder={pending ? t("chat.placeholderPending") : t("chat.placeholder")}
              className="w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-primary placeholder:text-muted focus:outline-none"
            />
            <div className="flex items-center gap-2 px-1 pb-0.5 pt-1">
              <select
                value={modelChoice}
                onChange={(e) => setModelChoice(e.target.value)}
                aria-label={t("chat.model.default")}
                className="max-w-[55%] truncate rounded-lg border border-line bg-surface px-2 py-1 font-mono text-xs text-secondary hover:border-accent-border focus:outline-none"
              >
                <option value="">{t("chat.model.default")}</option>
                {modelOptions.map((mo) => (
                  <option key={mo} value={mo}>
                    {mo}
                  </option>
                ))}
              </select>
              <span className="ml-auto hidden font-mono text-[10px] text-muted sm:inline">
                {pending ? t("chat.interruptHint") : t("chat.ctrlEnter")}
              </span>
              {pending ? (
                <button
                  type="button"
                  onClick={() => interrupt.mutate()}
                  disabled={interrupt.isPending}
                  title={t("chat.interruptHint")}
                  className="shrink-0 rounded-lg border border-err/50 px-3 py-1.5 text-xs font-semibold text-err hover:bg-err-soft disabled:opacity-50"
                >
                  {interrupt.isPending ? t("chat.interrupting") : t("chat.interrupt")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={trySend}
                  disabled={text.trim().length === 0 || send.isPending}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-40"
                >
                  <Icon icon={Send2} size={14} />
                  {send.isPending ? t("chat.sending") : t("chat.send")}
                </button>
              )}
            </div>
          </div>
          {send.isError || interrupt.isError ? (
            <p className="mt-2 text-xs text-err">
              {errorMessage(send.error ?? interrupt.error)}
            </p>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
