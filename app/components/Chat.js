"use client";

import Link from "next/link";
import ToolOutputViewer from "./ToolOutputViewer";

// Shared chat UI components used by the parent chat (page.js) and the
// worker pages. Extracted so both views keep the same visual language.

export function UserBubble({ content }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[92%] sm:max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-zinc-100 px-3.5 sm:px-4 py-2.5 text-sm text-zinc-900">
        {content}
      </div>
    </div>
  );
}

export function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-zinc-900 px-3.5 sm:px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export function BotMessage({ msg, onConfirm }) {
  if (msg.thinking) return <ThinkingBubble />;

  if (msg.error && !msg.data) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[92%] sm:max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-red-950 px-3.5 sm:px-4 py-2.5 text-sm text-red-300">
          {msg.error}
        </div>
      </div>
    );
  }

  if (msg.data?.mode === "response" || msg.data?.mode === "clarify") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[92%] sm:max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-zinc-900 px-3.5 sm:px-4 py-2.5 text-sm text-zinc-100">
          {msg.data.message}
        </div>
      </div>
    );
  }

  if (msg.data?.mode === "execution") {
    return <ExecutionCard data={msg.data} />;
  }

  if (msg.data?.mode === "plan") {
    return <PlanCard data={msg.data} prompt={msg.prompt} onConfirm={onConfirm} />;
  }

  if (msg.data?.message) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[92%] sm:max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-zinc-900 px-3.5 sm:px-4 py-2.5 text-sm text-zinc-100">
          {msg.data.message}
        </div>
      </div>
    );
  }

  return null;
}

export function PlanCard({ data, prompt, onConfirm, isConfirmed = false }) {
  const isForkPlan = data.steps?.some((s) => s.tool === "fork");

  return (
    <div className="w-full max-w-[95%] sm:max-w-[85%] rounded-2xl rounded-bl-md border border-zinc-800/80 bg-zinc-900/90 p-3.5 sm:p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-200">{data.reasoning}</p>
        {isForkPlan && (
          <span className="shrink-0 rounded-full border border-purple-800/60 bg-purple-950/70 px-2.5 py-0.5 text-[11px] font-medium text-purple-300">
            ⚡ Worker Task
          </span>
        )}
      </div>

      <ol className="mt-3.5 space-y-2.5">
        {data.steps.map((step) => {
          const isFork = step.tool === "fork";
          return (
            <li
              key={step.index}
              className={`flex items-start gap-2.5 sm:gap-3 rounded-xl border p-3 sm:p-3.5 transition ${
                isFork
                  ? "border-purple-800/50 bg-purple-950/20"
                  : "border-zinc-800/60 bg-zinc-950/60"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isFork
                    ? "bg-purple-800 text-purple-200"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                {step.index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <p className="text-sm font-medium text-zinc-100">{step.description}</p>
                  <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                    {step.tool}
                  </span>
                </div>
                {step.params && Object.keys(step.params).length > 0 && (
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-800/50 bg-zinc-950/80 p-2 font-mono text-[11px] text-zinc-400">
                    {JSON.stringify(step.params, null, 2)}
                  </pre>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/60 pt-3.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => !isConfirmed && onConfirm(prompt, data.plan_id)}
            disabled={isConfirmed}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold shadow-md transition ${
              isConfirmed
                ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                : isForkPlan
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-900/20 hover:from-purple-500 hover:to-indigo-500"
                : "bg-emerald-600 text-white shadow-emerald-900/20 hover:bg-emerald-500"
            }`}
          >
            {isConfirmed ? (
              <>
                <span className="h-2 w-2 rounded-full bg-zinc-500" />
                Plan Confirmed
              </>
            ) : (
              <>
                <span>▶</span>
                Confirm & Run Plan
              </>
            )}
          </button>
        </div>
        <span className="text-xs text-zinc-500">
          {data.steps.length} step{data.steps.length > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

export function ExecutionCard({ data }) {
  return (
    <div className="w-full max-w-[95%] sm:max-w-[85%] rounded-2xl rounded-bl-md border border-zinc-800/80 bg-zinc-900/90 p-3.5 sm:p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              data.success
                ? "border border-emerald-800/60 bg-emerald-950/60 text-emerald-300"
                : "border border-red-800/60 bg-red-950/60 text-red-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                data.success ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            {data.success ? "All steps completed" : "Some steps failed"}
          </span>
          <span className="text-xs text-zinc-500">
            {data.completed}/{data.total_steps} succeeded
          </span>
        </div>
      </div>

      <div className="mt-3.5 space-y-2.5">
        {data.results.map((r) => (
          <div
            key={r.index}
            className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-3 sm:p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded bg-zinc-800/70 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 shrink-0">
                  {r.tool}
                </span>
                <p className="text-sm font-medium text-zinc-200 truncate">{r.description}</p>
              </div>
              <span
                className={`text-xs font-semibold shrink-0 ${
                  r.success ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {r.success ? "✓ ok" : "✗ failed"}
              </span>
            </div>

            {r.error && (
              <p className="mt-2 rounded-lg border border-red-900/50 bg-red-950/40 p-2 text-xs text-red-400 break-words">
                {r.error.code ? `${r.error.code}: ` : ""}{r.error.message}
              </p>
            )}

            {r.success && r.data?.worker_url ? (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-purple-800/50 bg-gradient-to-r from-purple-950/60 to-indigo-950/40 p-3 shadow-md gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-900/80 text-xs text-purple-300 border border-purple-700/50 shrink-0">
                    ⚡
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-purple-200">
                        Worker Session Active
                      </p>
                      <span className="flex items-center gap-1 rounded-full bg-sky-950/80 border border-sky-600/40 px-2 py-0.5 text-[10px] text-sky-300 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-ping" />
                        <span>Live Stream</span>
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-purple-300/80 truncate">
                      {r.data.session_id}
                    </p>
                  </div>
                </div>
                <Link
                  href={r.data.worker_url}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md transition hover:from-purple-500 hover:to-indigo-500 shrink-0"
                >
                  <span>Watch Stream</span>
                  <span>→</span>
                </Link>
              </div>
            ) : r.success && r.data ? (
              <div className="mt-2">
                <ToolOutputViewer tool={r.tool} data={r.data} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}