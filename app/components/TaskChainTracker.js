"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

import { API_URL, apiFetch } from "../lib/api";

const isEmailTool = (t) => Boolean(t && (t === "send_email" || t.includes("email") || t.includes("gmail")));
const isDriveTool = (t) => Boolean(t && (t === "upload_drive_file" || t.includes("drive")));
const isWhatsAppTool = (t) => Boolean(t && (t.includes("whatsapp") || t === "send_file" || t === "send_message"));
const isWorkerTool = (t) => Boolean(t && (t === "fork" || t.includes("worker")));

const matchTools = (stepTool, targetTool) => {
  if (!stepTool || !targetTool) return false;
  if (stepTool === targetTool) return true;
  if (isEmailTool(stepTool) && isEmailTool(targetTool)) return true;
  if (isDriveTool(stepTool) && isDriveTool(targetTool)) return true;
  if (isWhatsAppTool(stepTool) && isWhatsAppTool(targetTool)) return true;
  if (isWorkerTool(stepTool) && isWorkerTool(targetTool)) return true;
  return stepTool.includes(targetTool) || targetTool.includes(stepTool);
};

const formatResultString = (res) => {
  if (!res) return "Action executed successfully";
  if (typeof res === "string") return res;
  if (res.sent) return `Email sent to ${res.to || "recipient"}`;
  if (res.file_id || res.id) return `Uploaded to Google Drive (${res.name || "file"})`;
  if (res.webViewLink) return `Uploaded to Google Drive (${res.name || "file"})`;
  if (res.message) return res.message;
  if (res.status && typeof res.status === "string") return `Status: ${res.status}`;
  return "Action executed successfully";
};

export default function TaskChainTracker({ activePlan, planExecution, isOpenMobile = false, onCloseMobile }) {
  const [pipelineSteps, setPipelineSteps] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const lastPlanIdRef = useRef(null);

  // Initialize steps whenever activePlan changes (only when a new plan is introduced)
  useEffect(() => {
    if (!activePlan || !activePlan.steps) {
      setPipelineSteps([]);
      lastPlanIdRef.current = null;
      setActiveSessionId(null);
      return;
    }

    if (activePlan.plan_id && lastPlanIdRef.current === activePlan.plan_id) {
      return; // Same plan already initialized, do not overwrite live state!
    }
    lastPlanIdRef.current = activePlan.plan_id || null;

    const steps = activePlan.steps.map((s, idx) => ({
      index: idx,
      tool: s.tool,
      description: s.description || s.tool,
      params: s.params || {},
      status: "waiting", // strictly waiting until plan is confirmed and executed!
      error: null,
      result: null,
      sessionId: null,
      currentSubStep: null,
    }));

    setPipelineSteps(steps);
    setActiveSessionId(null);
  }, [activePlan]);

  // Update step status if plan execution result arrives from chat
  useEffect(() => {
    if (!planExecution || !planExecution.results) return;

    let foundSid = null;
    for (const r of planExecution.results) {
      if (r.data?.session_id) foundSid = r.data.session_id;
      if (r.data?.target_session) foundSid = r.data.target_session;
    }
    if (foundSid) setActiveSessionId(foundSid);

    setPipelineSteps((prev) =>
      prev.map((step, idx) => {
        // If step is ALREADY completed, NEVER overwrite it back to waiting/running!
        if (step.status === "completed") {
          return step;
        }

        // Strictly match plan execution result by exact step index
        const exec = planExecution.results.find((r) => r.index === idx);
        if (exec) {
          const isChained = exec.data?.status === "chained";
          const isFork = isWorkerTool(step.tool);
          const sid = exec.data?.session_id || exec.data?.target_session || foundSid;

          let stepStatus = "completed";
          let stepResult = formatResultString(exec.data);
          let subStep = null;

          if (!exec.success) {
            stepStatus = "failed";
            stepResult = null;
          } else if (isChained) {
            stepStatus = "waiting";
            stepResult = null;
            subStep = null;
          } else if (isFork) {
            if (exec.data?.status === "awaiting_plan_approval") {
              stepStatus = "awaiting_plan_approval";
              subStep = "Awaiting implementation plan approval...";
            } else {
              stepStatus = "running";
              stepResult = null;
              subStep = "Worker initializing...";
            }
          }

          return {
            ...step,
            sessionId: sid || step.sessionId,
            status: stepStatus,
            result: stepResult,
            error: exec.error,
            currentSubStep: subStep,
          };
        }
        return step;
      })
    );
  }, [planExecution]);

  // Periodic status poll for workers & chained reactive hooks to ensure completion is detected immediately
  useEffect(() => {
    const sid = activeSessionId;
    if (!sid) return;

    let isMounted = true;

    async function checkChainStatus() {
      if (!isMounted || !sid) return;
      try {
        // 1. Check worker session status
        let workerIsDone = false;
        const res = await apiFetch(`/workers/${sid}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data) {
            const isDone = data.status === "completed" || data.progress_percent === 100;
            workerIsDone = isDone;

            setPipelineSteps((prev) =>
              prev.map((s) => {
                if (isWorkerTool(s.tool)) {
                  let nextStatus = s.status;
                  let nextSubStep = s.currentSubStep;
                  let nextResult = s.result;

                  if (isDone) {
                    nextStatus = "completed";
                    nextSubStep = null;
                    nextResult = "Worker completed successfully";
                  } else if (data.status === "cancelled" || data.status === "failed") {
                    nextStatus = "failed";
                    nextSubStep = null;
                  } else if (data.status === "awaiting_plan_approval") {
                    nextStatus = "awaiting_plan_approval";
                    nextSubStep = "Awaiting implementation plan approval...";
                  } else if (data.status === "running") {
                    nextStatus = "running";
                    nextSubStep = data.current_step || "Worker executing...";
                  }

                  return {
                    ...s,
                    sessionId: sid,
                    status: nextStatus,
                    currentSubStep: nextSubStep,
                    result: nextResult,
                  };
                }
                return s;
              })
            );
          }
        }

        // 2. Check reactive follow-up hooks status for this session
        const hooksRes = await apiFetch(`/events/hooks?session_id=${sid}`);
        if (hooksRes.ok && isMounted) {
          const hooks = await hooksRes.json();
          if (Array.isArray(hooks) && hooks.length > 0) {
            setPipelineSteps((prev) => {
              let updated = [...prev];
              const forkIdx = updated.findIndex((s) => isWorkerTool(s.tool));

              for (const h of hooks) {
                if (h.target_session_id && h.target_session_id !== sid) continue;

                // Match sequentially to follower steps after fork
                const targetIdx = updated.findIndex(
                  (s, idx) =>
                    idx > forkIdx &&
                    matchTools(s.tool, h.action_tool) &&
                    s.status !== "completed"
                );

                if (targetIdx !== -1) {
                  if (h.executed) {
                    updated[targetIdx] = {
                      ...updated[targetIdx],
                      status: "completed",
                      currentSubStep: null,
                      result: formatResultString(h.result),
                      error: null,
                    };
                  } else if (h.error) {
                    updated[targetIdx] = {
                      ...updated[targetIdx],
                      status: "failed",
                      currentSubStep: null,
                      error: h.error,
                    };
                  } else if (workerIsDone && updated[targetIdx].status === "waiting") {
                    updated[targetIdx] = {
                      ...updated[targetIdx],
                      status: "executing",
                      currentSubStep: "Autonomous execution in progress...",
                    };
                  }
                }
              }
              return updated;
            });
          }
        }
      } catch {
        // ignore network hiccups
      }
    }

    checkChainStatus();
    const interval = setInterval(checkChainStatus, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeSessionId]);

  // Listen to live SSE stream to update worker & chained hook completion in real time
  useEffect(() => {
    const es = new EventSource(`${API_URL}/events/stream`);

    es.onmessage = (e) => {
      try {
        const raw = e.data;
        if (!raw || raw.startsWith(":")) return;
        const evt = JSON.parse(raw);
        const type = evt.event_type || "";
        const data = evt.data || {};
        const evtSessionId = data.session_id || evt.metadata?.session_id;

        // 1. Worker Lifecycle updates
        if (type === "WORKER_BLOCKED") {
          setPipelineSteps((prev) => {
            let targetIdx = prev.findIndex(
              (s) => s.sessionId && evtSessionId && s.sessionId === evtSessionId
            );
            if (targetIdx === -1 && activeSessionId) {
              targetIdx = prev.findIndex(
                (s) => isWorkerTool(s.tool) && s.status !== "completed" && s.status !== "failed"
              );
            }
            if (targetIdx === -1) return prev;

            return prev.map((step, idx) => {
              if (idx === targetIdx) {
                return {
                  ...step,
                  status: "awaiting_plan_approval",
                  sessionId: evtSessionId || step.sessionId,
                  currentSubStep: "Awaiting implementation plan approval...",
                };
              }
              return step;
            });
          });
        } else if (type.includes("WORKER_STEP") || type === "WORKER_STARTED") {
          setPipelineSteps((prev) => {
            let targetIdx = prev.findIndex(
              (s) => s.sessionId && evtSessionId && s.sessionId === evtSessionId
            );
            if (targetIdx === -1 && activeSessionId) {
              targetIdx = prev.findIndex(
                (s) => isWorkerTool(s.tool) && s.status !== "completed" && s.status !== "failed"
              );
            }
            if (targetIdx === -1) return prev;

            return prev.map((step, idx) => {
              if (idx === targetIdx) {
                return {
                  ...step,
                  status: "running",
                  sessionId: evtSessionId || step.sessionId,
                  currentSubStep: data.step || data.message || "Working...",
                };
              }
              return step;
            });
          });
        }

        if (type === "WORKER_COMPLETED" || type.includes("WORKER_COMPLETED")) {
          setPipelineSteps((prev) => {
            let targetIdx = prev.findIndex(
              (s) => s.sessionId && evtSessionId && s.sessionId === evtSessionId
            );
            if (targetIdx === -1 && activeSessionId && activeSessionId === evtSessionId) {
              targetIdx = prev.findIndex(
                (s) => isWorkerTool(s.tool) && s.status !== "completed" && s.status !== "failed"
              );
            }
            if (targetIdx === -1) return prev;

            const artifactText = data.artifacts?.length
              ? `Created: ${data.artifacts.join(", ")}`
              : "Worker finished successfully";

            return prev.map((step, idx) => {
              if (idx === targetIdx) {
                return {
                  ...step,
                  status: "completed",
                  currentSubStep: null,
                  result: artifactText,
                };
              }
              return step;
            });
          });
        }

        // 2. Chained Autonomous Action updates
        if (type === "AUTONOMOUS_ACTION_STARTED") {
          const toolName = data.tool;
          setPipelineSteps((prev) => {
            let targetIdx = prev.findIndex(
              (s) =>
                s.status !== "completed" &&
                s.status !== "failed" &&
                matchTools(s.tool, toolName)
            );
            if (targetIdx === -1) return prev;

            return prev.map((step, idx) => {
              if (idx === targetIdx) {
                return {
                  ...step,
                  status: isWorkerTool(step.tool) ? "running" : "executing",
                  currentSubStep: `Executing ${step.tool}...`,
                };
              }
              return step;
            });
          });
        }

        if (type === "AUTONOMOUS_ACTION_EXECUTED") {
          const toolName = data.tool;
          const res = data.result;
          const isFork = isWorkerTool(toolName);
          const newSessionId = res?.session_id;
          if (newSessionId) setActiveSessionId(newSessionId);

          setPipelineSteps((prev) => {
            let targetIdx = prev.findIndex(
              (s) =>
                matchTools(s.tool, toolName) &&
                s.status !== "completed" &&
                s.status !== "failed"
            );
            if (targetIdx === -1) return prev;

            return prev.map((step, idx) => {
              if (idx === targetIdx) {
                if (isFork && newSessionId) {
                  return {
                    ...step,
                    status: "running",
                    sessionId: newSessionId,
                    currentSubStep: "Worker running...",
                  };
                }
                return {
                  ...step,
                  status: "completed",
                  currentSubStep: null,
                  result: formatResultString(res),
                };
              }
              if (!isFork && idx === targetIdx + 1 && step.status === "waiting") {
                return { ...step, status: "executing" };
              }
              return step;
            });
          });
        }

        if (type === "AUTONOMOUS_ACTION_FAILED") {
          const toolName = data.tool;
          const err = data.error;
          setPipelineSteps((prev) => {
            let targetIdx = prev.findIndex(
              (s) => matchTools(s.tool, toolName) && s.status !== "completed"
            );
            if (targetIdx === -1) return prev;
            return prev.map((step, idx) => {
              if (idx === targetIdx) {
                return {
                  ...step,
                  status: "failed",
                  currentSubStep: null,
                  error: err || "Action failed",
                };
              }
              return step;
            });
          });
        }
      } catch {
        // ignore
      }
    };

    return () => {
      es.close();
    };
  }, [activeSessionId]);

  const totalSteps = pipelineSteps.length;
  const doneSteps = pipelineSteps.filter((s) => s.status === "completed").length;
  const progressPercent = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;

  if (!pipelineSteps.length) {
    return (
      <aside className="hidden lg:flex w-72 flex-col border-r border-zinc-800/80 bg-zinc-950/70 p-4 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">🔗</span>
          <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Sequential Task Chain</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/80 p-6 text-center text-zinc-500">
          <span className="text-2xl mb-2">⛓️</span>
          <p className="text-xs font-medium text-zinc-400">No Active Pipeline</p>
          <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
            When you ask Jarvis to do sequential tasks (e.g. &quot;create file and send via WhatsApp&quot;), the live progress steps will appear here.
          </p>
        </div>
      </aside>
    );
  }

  const getStepIcon = (step) => {
    if (isWorkerTool(step.tool)) return "🛠️";
    if (isWhatsAppTool(step.tool)) return "💬";
    if (isEmailTool(step.tool)) return "✉️";
    if (isDriveTool(step.tool)) return "📁";
    return "⚡";
  };

  const content = (
    <div className="flex h-full flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs">
            🔗
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-tight">Event-Driven Task Chain</h2>
            <p className="text-[10px] text-zinc-400">Sequential Execution Order</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-purple-400 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded-full">
            {doneSteps}/{totalSteps} Done
          </span>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              aria-label="Close task chain"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all duration-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Ordered Step Cards */}
      <div className="space-y-3 flex-1 overflow-y-auto pr-0.5 scrollbar-thin">
        {pipelineSteps.map((step, idx) => {
          const isCompleted = step.status === "completed";
          const isExecuting = step.status === "executing" || step.status === "running";
          const isAwaitingApproval = step.status === "awaiting_plan_approval";
          const isFailed = step.status === "failed";
          const isWaiting = step.status === "waiting";

          return (
            <div
              key={idx}
              className={`relative rounded-xl border p-3 transition-all duration-300 ${
                isCompleted
                  ? "border-emerald-700/50 bg-emerald-950/20 shadow-sm"
                  : isAwaitingApproval
                  ? "border-amber-500/70 bg-amber-950/30 shadow-md shadow-amber-950/40 ring-1 ring-amber-500/40 animate-pulse"
                  : isExecuting
                  ? "border-purple-500/70 bg-purple-950/30 shadow-md shadow-purple-950/50 ring-1 ring-purple-500/40"
                  : isFailed
                  ? "border-red-700/60 bg-red-950/20"
                  : "border-zinc-800/80 bg-zinc-900/40 opacity-70"
              }`}
            >
              {/* Step indicator pill */}
              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800 text-[10px] font-bold text-zinc-300 border border-zinc-700/60 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-xs shrink-0">{getStepIcon(step)}</span>
                  <span className="text-xs font-semibold text-zinc-100 truncate max-w-[130px] sm:max-w-[150px]">
                    {step.tool}
                  </span>
                </div>

                {/* Live Status Badge */}
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 shrink-0">
                    ✓ Done
                  </span>
                )}
                {isAwaitingApproval && (
                  <Link
                    href={step.sessionId ? `/worker/${step.sessionId}` : "/workers"}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/30 transition shrink-0"
                  >
                    ⚠️ Review Plan →
                  </Link>
                )}
                {isExecuting && !isAwaitingApproval && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[10px] font-semibold text-purple-300 animate-pulse shrink-0">
                    ⚡ In Progress
                  </span>
                )}
                {isWaiting && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400 shrink-0">
                    ⏳ Waiting
                  </span>
                )}
                {isFailed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-semibold text-red-300 shrink-0">
                    ✕ Failed
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-zinc-300 leading-relaxed mb-1 break-words">
                {step.description}
              </p>

              {/* Dynamic Live Substep if running */}
              {(isExecuting || isAwaitingApproval) && step.currentSubStep && (
                <div className={`mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] ${
                  isAwaitingApproval
                    ? "bg-amber-950/60 border border-amber-800/60 text-amber-300"
                    : "bg-purple-950/60 border border-purple-800/60 text-purple-300"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full animate-ping shrink-0 ${
                    isAwaitingApproval ? "bg-amber-400" : "bg-purple-400"
                  }`} />
                  <span className="font-mono truncate">{step.currentSubStep}</span>
                </div>
              )}

              {/* Result / Output snippet */}
              {isCompleted && step.result && (
                <div className="mt-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 px-2 py-1 text-[10px] font-mono text-emerald-300/90 truncate">
                  {typeof step.result === "string" ? step.result : JSON.stringify(step.result)}
                </div>
              )}

              {/* Error Details */}
              {isFailed && step.error && (
                <div className="mt-2 rounded-lg bg-red-950/30 border border-red-800/40 px-2 py-1 text-[10px] font-mono text-red-300 truncate">
                  {typeof step.error === "string" ? step.error : step.error.message || JSON.stringify(step.error)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Session link footer if forked worker */}
      {activeSessionId && (
        <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
          <span className="text-zinc-500">Worker Session:</span>
          <Link
            href={`/worker/${activeSessionId}`}
            className="font-mono text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1"
          >
            <span>[{activeSessionId.slice(0, 8)}]</span>
            <span>↗</span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop permanent sidebar */}
      <aside className="hidden lg:flex w-80 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md overflow-hidden">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Slide-out Sheet */}
          <div className="fixed inset-y-0 left-0 w-full max-w-sm bg-zinc-950 border-r border-zinc-800 shadow-2xl z-10 flex flex-col">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
