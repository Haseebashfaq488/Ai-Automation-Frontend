"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import VoiceInput from "../../components/VoiceInput";
import ToolOutputViewer from "../../components/ToolOutputViewer";
import PowerControls from "../../components/PowerControls";

import { API_URL, apiFetch } from "../../lib/api";

const EVENT_STYLE = {
  WORK_STARTED: "text-sky-400",
  STEP_STARTED: "text-zinc-300",
  STEP_COMPLETED: "text-emerald-400",
  STEP_FAILED: "text-red-400",
  VALIDATION_STARTED: "text-yellow-400",
  VALIDATION_FAILED: "text-red-400",
  RECOVERY_STARTED: "text-orange-400",
  RECOVERY_COMPLETED: "text-emerald-400",
  PARENT_INTERVENTION: "text-purple-400",
  WORK_COMPLETED: "text-sky-300",
};

const STATUS_STYLE = {
  running: "border-sky-500/30 bg-sky-950/60 text-sky-300",
  awaiting_plan_approval: "border-amber-500/60 bg-amber-950/80 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]",
  completed: "border-emerald-500/30 bg-emerald-950/60 text-emerald-300",
  cancelled: "border-amber-500/30 bg-amber-950/60 text-amber-300",
  idle: "border-zinc-700/40 bg-zinc-900/60 text-zinc-400",
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function WorkerPage() {
  const params = useParams();
  const sessionId = params?.id;

  const [state, setState] = useState(null);
  const [events, setEvents] = useState([]);
  const [liveStreamText, setLiveStreamText] = useState("");
  const [streamActive, setStreamActive] = useState(false);
  const [streamStatus, setStreamStatus] = useState("connecting");
  const [artifacts, setArtifacts] = useState([]);
  const [resolution, setResolution] = useState(null);
  const [planText, setPlanText] = useState("");
  const [testResults, setTestResults] = useState(null);
  const [intervention, setIntervention] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [copiedStream, setCopiedStream] = useState(false);
  const [autoScrollStream, setAutoScrollStream] = useState(true);
  const [activeTab, setActiveTab] = useState("terminal"); // "terminal" | "plan" | "trace" | "tests" | "artifacts" | "review"
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [approvingPlan, setApprovingPlan] = useState(false);
  const [rejectingPlan, setRejectingPlan] = useState(false);
  const [planActionMsg, setPlanActionMsg] = useState(null);

  const eventsEndRef = useRef(null);
  const streamEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const rawStreamSourceRef = useRef(null);

  // ── 1. Fetch artifacts ────────────────────────────────────────────────
  const fetchArtifacts = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await apiFetch(`/workers/${sessionId}/artifacts`);
      if (res.ok) {
        const data = await res.json();
        setArtifacts(data.artifacts || []);
      }
    } catch {
      /* ignore background fetch errors */
    }
  }, [sessionId]);

  // ── 2. Fetch Implementation Plan (Job 1 Deliverable) ──────────────────
  const fetchPlan = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await apiFetch(`/workers/${sessionId}/plan`);
      if (res.ok) {
        const data = await res.json();
        if (data.plan) {
          setPlanText(data.plan);
        }
      }
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  // ── 3. Fetch Self-Testing Results (Job 3 Deliverable) ─────────────────
  const fetchTestResults = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await apiFetch(`/workers/${sessionId}/test-results`);
      if (res.ok) {
        const data = await res.json();
        if (data.test_results) {
          setTestResults(data.test_results);
        }
      }
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  // ── 4. Plan Approval Action ───────────────────────────────────────────
  const approvePlan = useCallback(async (customPlan) => {
    setApprovingPlan(true);
    setPlanActionMsg(null);
    try {
      const payload = customPlan !== undefined ? { plan: customPlan } : (planText ? { plan: planText } : {});
      const res = await apiFetch(`/workers/${sessionId}/approve-plan`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setState((prev) => prev ? {
        ...prev,
        status: "running",
        current_step: "Job 2: Execute Implementation Plan",
        plan_status: "approved",
      } : prev);
      setPlanActionMsg({ type: "success", text: "✓ Implementation plan approved! Worker starting Job 2 (Execution)..." });
      setTimeout(() => setPlanActionMsg(null), 7000);
      setActiveTab("terminal");
    } catch (e) {
      setPlanActionMsg({ type: "error", text: `Approval failed: ${e.message}` });
    } finally {
      setApprovingPlan(false);
    }
  }, [sessionId, planText]);

  // ── 5. Plan Revision Request Action ───────────────────────────────────
  const rejectPlan = useCallback(async (feedback) => {
    if (!feedback || !feedback.trim()) return;
    setRejectingPlan(true);
    setPlanActionMsg(null);
    try {
      const res = await apiFetch(`/workers/${sessionId}/reject-plan`, {
        method: "POST",
        body: JSON.stringify({ feedback: feedback.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setState((prev) => prev ? {
        ...prev,
        status: "running",
        current_step: "Revising Implementation Plan",
        plan_status: "rejected",
      } : prev);
      setPlanActionMsg({ type: "warning", text: "⚠ Feedback sent. Worker is revising the plan..." });
      setTimeout(() => setPlanActionMsg(null), 7000);
      setActiveTab("terminal");
    } catch (e) {
      setPlanActionMsg({ type: "error", text: `Revision request failed: ${e.message}` });
    } finally {
      setRejectingPlan(false);
    }
  }, [sessionId]);

  // ── 6. Fetch Jarvis Executive Resolution ──────────────────────────────
  const fetchResolution = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await apiFetch(`/workers/${sessionId}/resolution`);
      if (res.ok) {
        const data = await res.json();
        setResolution(data.evaluation || null);
      }
    } catch {
      /* resolution available only after completion */
    }
  }, [sessionId]);

  // ── 7. Poll worker state ─────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await apiFetch(`/workers/${sessionId}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setState(data);
          if (data.status === "awaiting_plan_approval" || data.plan_status === "ready" || data.implementation_plan) {
            fetchPlan();
          }
          if (data.status === "completed" || data.status === "cancelled") {
            setStreamActive(false);
            setStreamStatus("completed");
            fetchArtifacts();
            fetchResolution();
            fetchTestResults();
          }
        }
      } catch {
        /* backend unreachable — keep last state */
      }
    }

    poll();
    fetchArtifacts();
    fetchPlan();
    fetchTestResults();

    const id = setInterval(() => {
      poll();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId, fetchArtifacts, fetchResolution, fetchPlan, fetchTestResults]);

  // ── 4. Raw SSE live stream from CLI (/workers/{session_id}/stream) ──
  useEffect(() => {
    if (!sessionId) return;

    setStreamActive(true);
    setStreamStatus("streaming");

    const rawSource = new EventSource(`${API_URL}/workers/${sessionId}/stream`);
    rawStreamSourceRef.current = rawSource;

    rawSource.onmessage = (msg) => {
      if (!msg.data || msg.data.startsWith(":")) return; // heartbeat
      try {
        const ev = JSON.parse(msg.data);

        // 1. Step update events from agy
        if (ev.event === "step_update" || ev.step_update) {
          const su = ev.step_update || {};
          const delta = su.text_delta;
          if (delta) {
            setLiveStreamText((prev) => prev + delta);
          } else if (su.step_type === "tool" && su.state === "ACTIVE") {
            const toolName = su.tool_name || su.tool_info?.name || "tool";
            const params = su.tool_info?.parameters ? JSON.stringify(su.tool_info.parameters) : "";
            setLiveStreamText((prev) => prev + `\n\n⚙️ [Running Tool: ${toolName}] ${params}\n`);
          } else if (su.step_type === "tool" && su.state === "DONE") {
            const output = su.tool_info?.output;
            if (output && typeof output === "string") {
              const preview = output.length > 500 ? output.slice(0, 500) + "... [truncated]" : output;
              setLiveStreamText((prev) => prev + `\n📋 Output:\n${preview}\n`);
            }
          }
        } 
        // 2. OpenCode / Generic stream delta
        else if (ev.content || ev.text || ev.part?.text) {
          const chunk = ev.content || ev.text || ev.part?.text;
          setLiveStreamText((prev) => prev + chunk);
        }
        // 3. Engine high-level lifecycle events
        else if (ev.type === "STEP_STARTED") {
          const stepName = ev.data?.step || ev.step || "Executing Step";
          setLiveStreamText((prev) => prev + `\n\n▶ ${stepName}...\n`);
        }
        // 4. Final Result event
        else if (ev.event === "result") {
          const resp = ev.result?.response;
          if (resp && typeof resp === "string") {
            setLiveStreamText((prev) => (prev ? prev : resp));
          }
          setStreamActive(false);
          setStreamStatus("completed");
          fetchArtifacts();
          fetchResolution();
          rawSource.close();
        } else if (ev.type === "WORK_COMPLETED") {
          setStreamActive(false);
          setStreamStatus("completed");
          fetchArtifacts();
          fetchResolution();
          rawSource.close();
        }
      } catch {
        // Plain text stream fallback
        setLiveStreamText((prev) => prev + msg.data + "\n");
      }
    };

    rawSource.onerror = () => {
      if (state?.status === "completed" || state?.status === "cancelled") {
        setStreamActive(false);
        setStreamStatus("completed");
        rawSource.close();
      }
    };

    return () => {
      rawSource.close();
    };
  }, [sessionId, state?.status, fetchArtifacts, fetchResolution]);

  // ── 5. High-Level SSE lifecycle event stream (/workers/{session_id}/events) ──
  useEffect(() => {
    if (!sessionId) return;
    const seen = new Set();

    function pushEvent(raw) {
      try {
        const evt = JSON.parse(raw);
        const key = `${evt.type}:${JSON.stringify(evt.data)}`;
        if (seen.has(key)) return;
        seen.add(key);
        setEvents((prev) => [...prev, evt]);

        if (evt.type === "PLAN_READY") {
          fetchPlan();
          setState((prev) => prev ? {
            ...prev,
            status: "awaiting_plan_approval",
            current_step: "Awaiting Plan Approval",
            plan_status: "awaiting_approval",
            implementation_plan: evt.data?.plan || prev.implementation_plan,
          } : prev);
        } else if (evt.type === "PLAN_APPROVED") {
          setState((prev) => prev ? {
            ...prev,
            status: "running",
            current_step: "Job 2: Execute Implementation Plan",
            plan_status: "approved",
          } : prev);
        } else if (evt.type === "PLAN_REJECTED") {
          setState((prev) => prev ? {
            ...prev,
            status: "running",
            current_step: "Revising Implementation Plan",
            plan_status: "rejected",
          } : prev);
        } else if (evt.type === "STEP_STARTED") {
          const stepName = evt.data?.step;
          if (stepName) {
            setState((prev) => prev ? { ...prev, status: "running", current_step: stepName } : prev);
          }
        } else if (evt.type === "STEP_COMPLETED") {
          const stepName = evt.data?.step;
          if (stepName) {
            setState((prev) => {
              if (!prev) return prev;
              const completed = Array.isArray(prev.completed) ? [...prev.completed] : [];
              if (!completed.includes(stepName)) completed.push(stepName);
              return { ...prev, completed };
            });
          }
        } else if (evt.type === "WORK_COMPLETED") {
          fetchArtifacts();
          fetchResolution();
          fetchTestResults();
          setState((prev) => prev ? { ...prev, status: "completed", current_step: "Completed" } : prev);
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
          }
        }
      } catch {
        /* ignore malformed lines */
      }
    }

    const source = new EventSource(`${API_URL}/workers/${sessionId}/events`);
    eventSourceRef.current = source;

    source.onmessage = (msg) => pushEvent(msg.data);
    source.onerror = () => {
      if (state?.status === "completed" || state?.status === "cancelled") {
        source.close();
      }
    };

    return () => {
      source.close();
    };
  }, [sessionId, state?.status, fetchArtifacts, fetchResolution]);

  // Auto-scroll terminal stream
  useEffect(() => {
    if (autoScrollStream) {
      streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveStreamText, autoScrollStream]);

  // Auto-scroll raw events feed
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const sendIntervention = useCallback(async () => {
    const message = intervention.trim();
    if (!message) return;
    setIntervention("");
    try {
      await apiFetch(`/workers/${sessionId}/intervene`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
    } catch {
      /* ignore */
    }
  }, [intervention, sessionId]);

  const cancelWorker = useCallback(async () => {
    setCancelling(true);
    try {
      await apiFetch(`/workers/${sessionId}/cancel`, { method: "POST" });
    } catch {
      /* ignore */
    } finally {
      setCancelling(false);
    }
  }, [sessionId]);

  const [launchingTerminal, setLaunchingTerminal] = useState(false);
  const [terminalMsg, setTerminalMsg] = useState(null);

  const openDesktopTerminal = useCallback(async () => {
    setLaunchingTerminal(true);
    setTerminalMsg(null);
    try {
      const endpoint =
        state?.worker_type === "opencode_worker" || state?.worker_type === "opencode"
          ? "/workers/open-terminal"
          : "/workers/open-agy-terminal";

      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ directory: state?.fs_scope || "D:/AI-Automation" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setTerminalMsg(data.message || "✓ Terminal CLI window launched on desktop!");
      setTimeout(() => setTerminalMsg(null), 5000);
    } catch (e) {
      setTerminalMsg(`Failed: ${e.message}`);
      setTimeout(() => setTerminalMsg(null), 5000);
    } finally {
      setLaunchingTerminal(false);
    }
  }, [state?.fs_scope, state?.worker_type]);

  const copySessionId = useCallback(() => {
    navigator.clipboard.writeText(sessionId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }, [sessionId]);

  const displayText = liveStreamText || formatEventsToTerminal(events, state);

  const copyLiveStream = useCallback(() => {
    navigator.clipboard.writeText(displayText);
    setCopiedStream(true);
    setTimeout(() => setCopiedStream(false), 2000);
  }, [displayText]);

  if (notFound) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-white">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center shadow-xl backdrop-blur-md">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-950/60 text-red-400">
            ✕
          </div>
          <h2 className="text-lg font-semibold text-zinc-100">Worker Not Found</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Session <span className="font-mono text-zinc-300">{sessionId}</span> does not exist or has expired.
          </p>
          <Link
            href="/workers"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-sky-500"
          >
            ← Back to Worker Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentEvent = [...events].reverse().find((e) => e.type !== "WORK_COMPLETED");
  const nowDoing = state?.current_step || currentEvent?.data?.step || null;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white selection:bg-purple-500/30">
      {/* ── Top Bar ── */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2.5 sm:px-6 sm:py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5 sm:gap-4">
          <Link
            href="/workers"
            className="group flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            <span className="transition-transform group-hover:-translate-x-0.5">←</span>
            <span>Workers</span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-mono text-zinc-400">session /</span>
            <h1 className="font-mono text-xs sm:text-sm font-semibold text-zinc-100 truncate max-w-[130px] sm:max-w-none">{sessionId}</h1>
            <button
              onClick={copySessionId}
              title="Copy Session ID"
              className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
            >
              {copiedId ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <PowerControls />

          {terminalMsg && (
            <span className="text-xs text-emerald-400 font-medium animate-fade-in hidden sm:inline">
              {terminalMsg}
            </span>
          )}

          <button
            onClick={openDesktopTerminal}
            disabled={launchingTerminal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-700/60 bg-sky-950/60 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-sky-300 shadow-sm transition hover:border-sky-500 hover:bg-sky-900/60 hover:text-white disabled:opacity-40"
          >
            <span>💻</span>
            <span className="hidden sm:inline">{launchingTerminal ? "Opening..." : "Launch CLI"}</span>
            <span className="sm:hidden">CLI</span>
          </button>

          {/* Real-time Streaming Pulse Indicator */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-xs">
            {streamActive ? (
              <span className="flex items-center gap-1.5 text-sky-400 font-medium">
                <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" />
                <span>Live Stream Active</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-zinc-500" />
                <span>Stream Closed</span>
              </span>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs font-medium ${
              STATUS_STYLE[state?.status === "completed" || state?.progress_percent === 100 ? "completed" : state?.status] || STATUS_STYLE.idle
            }`}
          >
            {state?.status === "running" && (state?.progress_percent ?? 0) < 100 && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
            )}
            {(state?.status === "completed" || state?.progress_percent === 100) && (
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            )}
            {state?.status === "cancelled" && (
              <span className="h-2 w-2 rounded-full bg-amber-400" />
            )}
            {state?.status === "completed" || state?.progress_percent === 100
              ? "completed"
              : (state?.status || "connecting…")}
          </span>

          {state?.status === "running" && (state?.progress_percent ?? 0) < 100 && (
            <button
              onClick={cancelWorker}
              disabled={cancelling}
              className="rounded-lg border border-red-900/60 bg-red-950/40 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-900/60 disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </header>

      {/* ── Main Two-Column View ── */}
      <div className="flex flex-1 overflow-y-auto lg:overflow-hidden flex-col lg:flex-row">
        {/* Left Column: Live Streaming Terminal & Trace Views */}
        <div className="flex-1 w-full lg:overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-6 scrollbar-thin">
          <div className="mx-auto flex max-w-4xl flex-col gap-5">
            {/* Task Contract Card */}
            <ContractCard state={state} sessionId={sessionId} />

            {/* Prominent Plan Approval Banner if Worker is Paused Awaiting Plan Approval */}
            {state?.status === "awaiting_plan_approval" && (
              <PlanApprovalCard
                planText={planText}
                state={state}
                onApprove={approvePlan}
                onReject={rejectPlan}
                approving={approvingPlan}
                rejecting={rejectingPlan}
                actionMsg={planActionMsg}
              />
            )}

            {/* Navigation Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-2 gap-2">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 sm:pb-0 flex-nowrap">
                <button
                  onClick={() => setActiveTab("terminal")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold shrink-0 transition ${
                    activeTab === "terminal"
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30"
                      : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                  <span>⚡ Live Output</span>
                  {displayText && (
                    <span className="ml-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-mono">
                      {displayText.length} chars
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("plan")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold shrink-0 transition ${
                    activeTab === "plan"
                      ? "bg-amber-950/80 text-amber-200 border border-amber-600/80 shadow-md shadow-amber-950/40"
                      : state?.status === "awaiting_plan_approval"
                      ? "bg-amber-950/40 text-amber-300 border border-amber-500/50 animate-pulse"
                      : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  <span>📑 Plan</span>
                  {state?.status === "awaiting_plan_approval" && (
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                  {planText && (
                    <span className="rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                      {state?.status === "awaiting_plan_approval" ? "Review" : "Ready"}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("trace")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold shrink-0 transition ${
                    activeTab === "trace"
                      ? "bg-zinc-800 text-white shadow-md border border-zinc-700"
                      : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  <span>📋 Trace</span>
                  <span className="ml-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-mono">
                    {events.filter((e) => e.type.startsWith("STEP_")).length}
                  </span>
                </button>

                {(testResults || state?.test_results || state?.status === "completed") && (
                  <button
                    onClick={() => setActiveTab("tests")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold shrink-0 transition ${
                      activeTab === "tests"
                        ? "bg-emerald-950/80 text-emerald-200 border border-emerald-600 shadow-md"
                        : "bg-zinc-900/80 text-emerald-400/80 hover:bg-zinc-800 hover:text-emerald-300 border border-emerald-900/40"
                    }`}
                  >
                    <span>🧪 Verification</span>
                    {testResults?.passed !== undefined && (
                      <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">
                        {testResults.passed}/{testResults.total}
                      </span>
                    )}
                  </button>
                )}

                {artifacts.length > 0 && (
                  <button
                    onClick={() => setActiveTab("artifacts")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold shrink-0 transition ${
                      activeTab === "artifacts"
                        ? "bg-purple-950/80 text-purple-200 border border-purple-700"
                        : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"
                    }`}
                  >
                    <span>📦 Artifacts</span>
                    <span className="rounded bg-purple-900/60 px-1.5 py-0.5 text-[10px] font-mono text-purple-300">
                      {artifacts.length}
                    </span>
                  </button>
                )}

                {resolution && (
                  <button
                    onClick={() => setActiveTab("review")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2 text-xs font-semibold shrink-0 transition ${
                      activeTab === "review"
                        ? "bg-purple-900 text-white shadow-md"
                        : "bg-zinc-900/80 text-purple-300 hover:bg-zinc-800 border border-purple-900/40"
                    }`}
                  >
                    <span>🧠 Quality Review</span>
                  </button>
                )}
              </div>

              {activeTab === "terminal" && (
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  <button
                    onClick={() => setAutoScrollStream(!autoScrollStream)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
                      autoScrollStream
                        ? "border-sky-700 bg-sky-950/60 text-sky-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-500"
                    }`}
                  >
                    {autoScrollStream ? "✓ Auto-scroll ON" : "Auto-scroll OFF"}
                  </button>
                  <button
                    onClick={copyLiveStream}
                    disabled={!displayText}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-[11px] font-mono text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
                  >
                    {copiedStream ? "✓ Copied" : "Copy Output"}
                  </button>
                </div>
              )}
            </div>

            {/* TAB CONTENT 1: Real-Time Live Terminal */}
            {activeTab === "terminal" && (
              <LiveWorkerTerminal
                displayText={displayText}
                liveStreamText={liveStreamText}
                streamActive={streamActive}
                streamStatus={streamStatus}
                streamEndRef={streamEndRef}
                state={state}
              />
            )}

            {/* TAB CONTENT 2: Implementation Plan Review & Modification */}
            {activeTab === "plan" && (
              <PlanApprovalCard
                planText={planText}
                state={state}
                onApprove={approvePlan}
                onReject={rejectPlan}
                approving={approvingPlan}
                rejecting={rejectingPlan}
                actionMsg={planActionMsg}
                fullPageMode={true}
              />
            )}

            {/* TAB CONTENT 3: Execution Trace Steps */}
            {activeTab === "trace" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Execution Trace & Tool Results
                  </span>
                  <span className="text-xs text-zinc-500">
                    {events.filter((e) => e.type.startsWith("STEP_")).length} step events
                  </span>
                </div>

                {events
                  .filter((e) => e.type.startsWith("STEP_") || e.type === "PARENT_INTERVENTION")
                  .map((e, i) => (
                    <StepBubble key={i} event={e} stepIndex={i + 1} />
                  ))}

                {events.length === 0 && (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-800/80 p-8 text-center text-xs text-zinc-500">
                    Waiting for worker to start execution…
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 4: Self-Testing & Verification Results */}
            {activeTab === "tests" && (
              <TestResultsCard testResults={testResults || state?.test_results} state={state} />
            )}

            {/* TAB CONTENT 5: Artifacts */}
            {activeTab === "artifacts" && (
              <ArtifactsPanel artifacts={artifacts} sessionId={sessionId} />
            )}

            {/* TAB CONTENT 6: Review */}
            {activeTab === "review" && resolution && (
              <JarvisExecutiveReviewCard evaluation={resolution} />
            )}

            {/* Always display quality review on completion if available */}
            {resolution && activeTab !== "review" && (
              <JarvisExecutiveReviewCard evaluation={resolution} />
            )}

            {/* Artifacts Download Panel */}
            {artifacts.length > 0 && activeTab !== "artifacts" && (
              <ArtifactsPanel artifacts={artifacts} sessionId={sessionId} />
            )}

            {/* Result Card when completed */}
            {events.some((e) => e.type === "WORK_COMPLETED") && !resolution && (
              <ResultCard
                event={events.find((e) => e.type === "WORK_COMPLETED")}
                artifactsCount={artifacts.length}
              />
            )}
          </div>
        </div>

        {/* Right Sidebar: Live State & Intervention */}
        <aside className="flex w-full lg:w-84 shrink-0 flex-col border-t lg:border-t-0 lg:border-l border-zinc-800/80 bg-zinc-900/30">
          {/* Progress & Current Step */}
          <div className="border-b border-zinc-800/80 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Active Step
              </p>
              <span className="font-mono text-xs font-semibold text-sky-400">
                {state?.status === "completed" ? 100 : (state?.progress_percent ?? 0)}%
              </span>
            </div>

            <div className="mt-2.5 flex items-start gap-2">
              {state?.status === "running" && (state?.progress_percent ?? 0) < 100 ? (
                <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-400" />
              ) : state?.status === "completed" || (state?.progress_percent ?? 0) === 100 ? (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              ) : (
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-zinc-600" />
              )}
              <p className="text-sm font-medium text-zinc-200">
                {state?.status === "completed" || (state?.progress_percent ?? 0) === 100
                  ? "All steps finished"
                  : (nowDoing || (state?.status === "running" ? "Executing..." : "Waiting…"))}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-purple-500 transition-all duration-500"
                style={{ width: `${state?.status === "completed" ? 100 : (state?.progress_percent ?? 0)}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="border-b border-zinc-800/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Checklist
            </p>
            <div className="mt-2.5 max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {(state?.completed || []).map((c, i) => (
                <div key={`comp-${i}`} className="flex items-start gap-2 text-xs text-emerald-400">
                  <span className="shrink-0 font-bold">✓</span>
                  <span className="line-clamp-2 text-zinc-300">{c}</span>
                </div>
              ))}
              {(state?.errors || []).map((e, i) => (
                <div key={`err-${i}`} className="flex items-start gap-2 text-xs text-red-400">
                  <span className="shrink-0 font-bold">✗</span>
                  <span className="line-clamp-2">{e}</span>
                </div>
              ))}
              {(state?.completed || []).length === 0 && (state?.errors || []).length === 0 && (
                <p className="text-xs text-zinc-600 italic">No checklist items recorded yet</p>
              )}
            </div>
          </div>

          {/* Raw SSE Event Stream */}
          <div className="flex flex-col h-64 lg:h-auto lg:flex-1 overflow-hidden p-4">
            <div className="flex items-center justify-between pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Live Event Bus
              </p>
              <span className="font-mono text-[10px] text-zinc-500">{events.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-800/70 bg-zinc-950/80 p-2.5 font-mono text-[11px]">
              <ul className="space-y-1">
                {events.map((e, i) => (
                  <li key={i} className={`truncate ${EVENT_STYLE[e.type] || "text-zinc-400"}`}>
                    <span className="text-zinc-600 mr-1.5">{i + 1}</span>
                    <span className="font-medium">{e.type}</span>
                    {e.data?.step && (
                      <span className="ml-1 text-zinc-400">· {e.data.step}</span>
                    )}
                  </li>
                ))}
                <div ref={eventsEndRef} />
              </ul>
            </div>
          </div>

          {/* Intervention Panel (Parent Agent Control) */}
          {state?.status === "running" && (
            <div className="border-t border-zinc-800/80 bg-zinc-900/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                  ⚡ Intervene (Parent Agent)
                </p>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                Send instructions directly into the running worker's next prompt loop.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  value={intervention}
                  onChange={(e) => setIntervention(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendIntervention()}
                  placeholder="e.g. Focus on unit tests first..."
                  className="flex-1 rounded-xl border border-zinc-700/80 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500 transition"
                />
                <VoiceInput
                  onTranscriptInsert={(text) =>
                    setIntervention((prev) => (prev ? `${prev} ${text}` : text))
                  }
                  onAutoSend={async (text) => {
                    setIntervention(text);
                    try {
                      await apiFetch(`/workers/${sessionId}/intervene`, {
                        method: "POST",
                        body: JSON.stringify({ message: text }),
                      });
                      setIntervention("");
                    } catch {
                      // ignore
                    }
                  }}
                />
                <button
                  onClick={sendIntervention}
                  disabled={!intervention.trim()}
                  className="rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-purple-500 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Format structured events and states into a live terminal log ──────────
function formatEventsToTerminal(events, state) {
  if (!events || !events.length) {
    if (state?.objective) {
      return `[Antigravity Stream Console]\nSession ID: ${state.session_id || ""}\nObjective: ${state.objective}\nWorkspace Scope: ${state.fs_scope || "D:/AI-Automation"}\nStatus: ${state.status || "initializing"}...\n`;
    }
    return "";
  }
  const lines = [];
  lines.push(`[Antigravity Stream Console]`);
  if (state?.objective) {
    lines.push(`Objective: ${state.objective}`);
  }
  if (state?.fs_scope) {
    lines.push(`Workspace: ${state.fs_scope}`);
  }
  lines.push(`Driver: ${state?.worker_type || "antigravity_worker"} | Model: ${state?.model || "default"} | Status: ${state?.status || "running"}`);
  lines.push("─".repeat(60));

  events.forEach((ev, i) => {
    const type = ev.type || ev.event || "EVENT";
    if (type === "WORK_STARTED") {
      lines.push(`[SYSTEM] ● Session started. Initialized autonomous loop.`);
    } else if (type === "STEP_STARTED") {
      lines.push(`\n[STEP #${(ev.data?.index ?? i) + 1}] ▶ ${ev.data?.step || ev.step || "Executing action..."}`);
    } else if (type === "STEP_COMPLETED") {
      const preview = ev.data?.output?.output_preview || (typeof ev.data?.output === "string" ? ev.data.output : null);
      lines.push(`[STEP #${(ev.data?.index ?? i) + 1}] ✓ Completed.`);
      if (preview) {
        lines.push(`   Output: ${preview}`);
      }
    } else if (type === "STEP_FAILED") {
      lines.push(`[STEP #${(ev.data?.index ?? i) + 1}] ✗ FAILED: ${ev.data?.error || ev.error || "Execution error"}`);
    } else if (type === "PARENT_INTERVENTION") {
      lines.push(`\n[PARENT INTERVENTION] ⚡ Directive: ${ev.data?.message || ""}`);
    } else if (type === "WORK_COMPLETED") {
      lines.push(`\n[FINAL] ■ WORK_COMPLETED: ${ev.data?.summary || (ev.data?.success ? "All steps finished successfully." : "Session finalized.")}`);
      if (ev.data?.artifacts?.length) {
        lines.push(`   Artifacts: ${ev.data.artifacts.join(", ")}`);
      }
    } else if (ev.data?.step || ev.data?.result) {
      lines.push(`[${type}] ${ev.data.step || JSON.stringify(ev.data.result)}`);
    }
  });

  return lines.join("\n");
}

// ── Live Worker Terminal Component ──────────────────────────────────────
function LiveWorkerTerminal({ displayText, liveStreamText, streamActive, streamStatus, streamEndRef, state }) {
  const content = liveStreamText || displayText;
  const isFinished = state?.status === "completed" || state?.status === "cancelled" || (!streamActive && Boolean(content));

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-800/90 bg-zinc-950 shadow-2xl overflow-hidden">
      {/* Terminal Title Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3.5 sm:px-4 py-2.5 sm:py-3 gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-yellow-500/80" />
            <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 border-l border-zinc-800 pl-2.5 sm:pl-3 min-w-0">
            <span className="font-mono text-xs font-semibold text-zinc-200 truncate">
              Antigravity Stream
            </span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 shrink-0">
              {state?.model || "default"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {streamActive && !isFinished ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-950/70 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-sky-300">
              <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 animate-ping rounded-full bg-sky-400" />
              <span>STREAMING</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-[10px] sm:text-[11px] text-zinc-400">
              <span>FINISHED</span>
            </span>
          )}
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="p-3.5 sm:p-4 font-mono text-xs leading-relaxed text-zinc-200 max-h-[560px] min-h-[260px] sm:min-h-[320px] overflow-y-auto whitespace-pre-wrap selection:bg-purple-500/40 break-words">
        {content ? (
          <>
            <span>{content}</span>
            {streamActive && !isFinished && (
              <span className="inline-block h-4 w-2 animate-pulse bg-sky-400 align-middle ml-0.5" />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-600 px-4">
            <div className="mb-2 h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            <p className="text-xs">Connecting to Antigravity CLI live stream…</p>
            <p className="mt-1 text-[11px] text-zinc-600 max-w-sm">
              Streaming real-time step updates, thinking deltas, and tool executions.
            </p>
          </div>
        )}
        <div ref={streamEndRef} />
      </div>

      {/* Terminal Footer */}
      <div className="flex flex-wrap items-center justify-between border-t border-zinc-800/80 bg-zinc-900/40 px-3.5 sm:px-4 py-2 text-[10px] sm:text-[11px] text-zinc-500 gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <span>Mode: <strong className="text-zinc-400">stream-json</strong></span>
          <span>•</span>
          <span>Buffer: <strong className="text-zinc-400">{content.length} chars</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span>Worker: <strong className="text-purple-400">{state?.worker_type || "antigravity"}</strong></span>
        </div>
      </div>
    </div>
  );
}

// ── Contract Card Component ─────────────────────────────────────────────
function ContractCard({ state, sessionId }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-950 text-xs text-sky-400">
              📋
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Task Contract
            </p>
          </div>
          <h2 className="mt-2 text-base font-semibold text-zinc-100">
            {state?.objective || "Forked Autonomous Task"}
          </h2>
        </div>

        {state?.max_steps && (
          <div className="text-right">
            <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-400">
              Budget: {state.max_steps} steps
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Filesystem Scope
          </p>
          <p className="mt-1 truncate font-mono text-xs text-zinc-300" title={state?.fs_scope}>
            {state?.fs_scope || "D:/AI-Automation"}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Worker Driver
          </p>
          <p className="mt-1 truncate font-mono text-xs text-purple-300">
            {state?.worker_type || "antigravity_worker"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Jarvis Executive Review Card (Quality Guardian) ─────────────────────
function JarvisExecutiveReviewCard({ evaluation }) {
  const verdict = evaluation?.verdict || "RESOLVED";
  const isResolved = verdict === "RESOLVED";
  const isCancelled = verdict === "CANCELLED";

  const badgeStyle = isResolved
    ? "border-emerald-500/40 bg-emerald-950/70 text-emerald-300"
    : isCancelled
    ? "border-amber-500/40 bg-amber-950/70 text-amber-300"
    : "border-red-500/40 bg-red-950/70 text-red-300";

  return (
    <div className="rounded-2xl border border-purple-800/50 bg-gradient-to-br from-purple-950/40 via-zinc-900/90 to-zinc-950/90 p-5 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-900/70 text-sm font-bold text-purple-200 border border-purple-700/50 shadow-inner">
            🧠
          </span>
          <div>
            <h3 className="text-sm font-semibold text-purple-100">
              Jarvis Executive Quality Review
            </h3>
            <p className="text-xs text-purple-300/70">
              Supervisor post-execution evaluation & verification
            </p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${badgeStyle}`}>
          <span>{isResolved ? "✓" : isCancelled ? "⏸" : "✗"}</span>
          <span>{verdict}</span>
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4">
        <h4 className="text-sm font-medium text-zinc-100">
          {evaluation?.headline || "Execution completed"}
        </h4>
        {evaluation?.summary && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">
            {evaluation.summary}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-zinc-800/70 pt-3 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>Completed Steps: <strong className="text-zinc-200">{evaluation?.steps_completed ?? 0}</strong></span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-purple-400 font-bold">🧠</span>
            <span>Recorded in <strong className="text-zinc-200 font-mono text-[11px]">JARVIS_MEMORY.md</strong></span>
          </div>

          {evaluation?.errors?.length > 0 && (
            <div className="flex items-center gap-1.5 text-red-400">
              <span>✗</span>
              <span>Errors: {evaluation.errors.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Artifacts Panel Component ───────────────────────────────────────────
function ArtifactsPanel({ artifacts, sessionId }) {
  if (!artifacts || artifacts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-purple-900/40 bg-purple-950/10 p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-900/60 text-xs text-purple-300">
            📦
          </span>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-300">
            Generated Deliverables & Artifacts ({artifacts.length})
          </h3>
        </div>
        <span className="text-xs text-purple-400/80">Direct download available</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {artifacts.map((art) => (
          <div
            key={art.name}
            className="flex items-center justify-between gap-3 rounded-xl border border-purple-800/30 bg-zinc-950/70 p-3 transition hover:border-purple-600/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100" title={art.name}>
                {art.name}
              </p>
              <p className="text-xs text-zinc-500">{formatBytes(art.size_bytes)}</p>
            </div>
            <a
              href={`${API_URL}/workers/${sessionId}/artifacts/${encodeURIComponent(art.name)}`}
              download={art.name}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-500"
            >
              <span>Download</span>
              <span>↓</span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step Bubble Component ───────────────────────────────────────────────
function StepBubble({ event, stepIndex }) {
  const [showDetails, setShowDetails] = useState(false);

  if (event.type === "PARENT_INTERVENTION") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-purple-900/60 bg-purple-950/70 px-4 py-3 text-sm text-purple-200 shadow-md">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-400">
            <span>⚡ Parent Intervention</span>
          </div>
          <p className="mt-1 text-sm font-medium">{event.data?.message}</p>
        </div>
      </div>
    );
  }

  const ok = event.type === "STEP_COMPLETED";
  const failed = event.type === "STEP_FAILED";
  const running = event.type === "STEP_STARTED";
  const outputData = event.data?.output || event.data?.result;

  const stepName =
    event.data?.step ||
    (typeof outputData === "object" && outputData?.tool ? outputData.tool : `Action #${stepIndex}`);

  const previewText = outputData?.output_preview || (typeof outputData === "string" ? outputData : null);

  return (
    <div className="flex justify-start">
      <div
        className={`w-full max-w-[90%] rounded-2xl rounded-bl-md border px-4 py-3.5 text-sm shadow-md transition ${
          ok
            ? "border-emerald-900/60 bg-emerald-950/40 text-zinc-200"
            : failed
            ? "border-red-900/60 bg-red-950/40 text-red-200"
            : running
            ? "border-sky-900/60 bg-sky-950/30 text-zinc-200"
            : "border-zinc-800/80 bg-zinc-900/60 text-zinc-300"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                ok
                  ? "bg-emerald-900/60 text-emerald-300"
                  : failed
                  ? "bg-red-900/60 text-red-300"
                  : running
                  ? "bg-sky-900/60 text-sky-300"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {ok ? "✓ Completed" : failed ? "✗ Failed" : running ? "● Running" : event.type}
            </span>

            <span className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-400 border border-zinc-800">
              Step {stepIndex}
            </span>
          </div>
        </div>

        <h4 className="mt-2 text-sm font-semibold text-zinc-100">
          {stepName}
        </h4>

        {failed && event.data?.error && (
          <div className="mt-2 rounded-lg border border-red-900/60 bg-red-950/60 p-2.5 text-xs text-red-300">
            {event.data.error}
          </div>
        )}

        {/* Output Preview / Text */}
        {previewText && (
          <div className="mt-2.5 rounded-xl border border-zinc-800/70 bg-zinc-950/80 p-3 text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
            {previewText}
          </div>
        )}

        {/* Structured Output Viewer */}
        {outputData && typeof outputData === "object" && (
          <div className="mt-2.5">
            <ToolOutputViewer
              tool={event.data?.step || ""}
              data={outputData}
            />
          </div>
        )}

        {/* Raw event data toggle */}
        {outputData && (
          <div className="mt-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition"
            >
              <span>{showDetails ? "Hide raw ▲" : "Inspect raw JSON ▼"}</span>
            </button>

            {showDetails && (
              <pre className="mt-1.5 max-h-48 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/90 p-2.5 font-mono text-[11px] text-zinc-300">
                {typeof outputData === "string"
                  ? outputData
                  : JSON.stringify(outputData, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Result Card Component ───────────────────────────────────────────────
function ResultCard({ event, artifactsCount }) {
  const success = event?.data?.success;
  return (
    <div
      className={`rounded-2xl border p-5 shadow-xl backdrop-blur-md ${
        success
          ? "border-emerald-800/60 bg-emerald-950/40"
          : "border-amber-800/60 bg-amber-950/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-base font-bold ${
              success ? "bg-emerald-900/80 text-emerald-300" : "bg-amber-900/80 text-amber-300"
            }`}
          >
            {success ? "✓" : "!"}
          </span>
          <div>
            <h3
              className={`text-sm font-semibold ${
                success ? "text-emerald-200" : "text-amber-200"
              }`}
            >
              {success ? "Worker Goal Completed Successfully" : "Worker Finished with Warnings"}
            </h3>
            <p className="text-xs text-zinc-400">
              Session execution finalized. Check artifacts and checklist above.
            </p>
          </div>
        </div>

        <Link
          href="/workers"
          className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700"
        >
          All Workers →
        </Link>
      </div>

      {event?.data?.tools_used?.length > 0 && (
        <div className="mt-3.5 flex items-center gap-2 border-t border-zinc-800/60 pt-3">
          <span className="text-xs text-zinc-400">Tools invoked:</span>
          <div className="flex flex-wrap gap-1">
            {event.data.tools_used.map((t) => (
              <span
                key={t}
                className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plan Approval & Review Card Component (Job 1 Gate) ─────────────────
function PlanApprovalCard({
  planText,
  state,
  onApprove,
  onReject,
  approving,
  rejecting,
  actionMsg,
  fullPageMode = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftPlan, setDraftPlan] = useState(planText || "");
  const [feedback, setFeedback] = useState("");
  const [showFeedbackBox, setShowFeedbackBox] = useState(false);

  // Sync draftPlan when planText changes
  useEffect(() => {
    if (planText) setDraftPlan(planText);
  }, [planText]);

  const isAwaiting = state?.status === "awaiting_plan_approval";

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isAwaiting
          ? "border-amber-500/60 bg-gradient-to-br from-amber-950/40 via-zinc-900/90 to-zinc-950/95 shadow-2xl shadow-amber-950/30 ring-1 ring-amber-500/30"
          : "border-zinc-800/80 bg-zinc-900/80 shadow-xl"
      } p-4 sm:p-6 backdrop-blur-md`}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl border text-base font-bold shadow-inner shrink-0 ${
              isAwaiting
                ? "border-amber-500/50 bg-amber-900/70 text-amber-200"
                : "border-purple-800/50 bg-purple-950/70 text-purple-200"
            }`}
          >
            📑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Implementation Plan
              </h3>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                Job 1 of 3
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {isAwaiting
                ? "Worker formulated this strategy and is awaiting your explicit review & approval."
                : "Strategy generated and executed for this task."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAwaiting ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/60 bg-amber-950/80 px-3 py-1 text-xs font-semibold text-amber-300 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>Awaiting Approval</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span>✓ Plan Active / Approved</span>
            </span>
          )}
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionMsg && (
        <div
          className={`mt-4 rounded-xl border p-3 text-xs font-medium ${
            actionMsg.type === "success"
              ? "border-emerald-800/80 bg-emerald-950/60 text-emerald-300"
              : actionMsg.type === "warning"
              ? "border-amber-800/80 bg-amber-950/60 text-amber-300"
              : "border-red-800/80 bg-red-950/60 text-red-300"
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      {/* Controls Bar for Plan Editing and Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 pb-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(false)}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              !isEditing
                ? "bg-zinc-800 text-white shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            👁️ Preview Plan
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              isEditing
                ? "bg-zinc-800 text-white shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            ✏️ Edit Markdown
          </button>
        </div>

        {isAwaiting && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFeedbackBox(!showFeedbackBox)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 font-medium text-zinc-300 transition hover:border-amber-600/50 hover:bg-zinc-800 hover:text-white"
            >
              <span>💬</span>
              <span>{showFeedbackBox ? "Hide Revisions" : "Request Changes"}</span>
            </button>

            <button
              onClick={() => onApprove(isEditing ? draftPlan : undefined)}
              disabled={approving || rejecting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 font-semibold text-white shadow-lg shadow-emerald-950/40 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
            >
              {approving ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Approving...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>{isEditing ? "Save & Approve Plan" : "Approve & Start Execution"}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Revisions & Feedback Input Box */}
      {showFeedbackBox && isAwaiting && (
        <div className="mt-4 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Provide Revision Directives
            </p>
            <span className="text-[11px] text-zinc-400">Worker will re-plan based on this feedback</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onReject(feedback)}
              placeholder="e.g. Add validation for edge cases, also include unit tests in tests/unit/..."
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500"
            />
            <VoiceInput
              onTranscriptInsert={(text) =>
                setFeedback((prev) => (prev ? `${prev} ${text}` : text))
              }
              onAutoSend={(text) => {
                setFeedback(text);
                onReject(text);
              }}
            />
            <button
              onClick={() => onReject(feedback)}
              disabled={rejecting || !feedback.trim()}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3.5 py-2 font-semibold text-white shadow-md transition hover:bg-amber-500 disabled:opacity-40 shrink-0"
            >
              {rejecting ? "Sending..." : "Send Revisions ➔"}
            </button>
          </div>
        </div>
      )}

      {/* Plan Content Body */}
      <div className="mt-4">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span>Markdown Editor (live edits will be sent on approval)</span>
              <span>{draftPlan.length} chars</span>
            </div>
            <textarea
              value={draftPlan}
              onChange={(e) => setDraftPlan(e.target.value)}
              rows={fullPageMode ? 20 : 12}
              className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100 outline-none focus:border-purple-500 resize-y selection:bg-purple-500/40"
              placeholder="# Implementation Plan..."
            />
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 sm:p-5 font-sans text-xs leading-relaxed text-zinc-200">
            {planText || draftPlan ? (
              <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-200 selection:bg-purple-500/40 break-words">
                {planText || draftPlan}
              </pre>
            ) : (
              <div className="py-8 text-center text-zinc-500">
                <p className="text-xs">No implementation plan generated yet.</p>
                <p className="mt-1 text-[11px]">Worker is initializing Job 1 (Planning)...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Test Results Card Component (Job 3 Self-Verification) ───────────────
function TestResultsCard({ testResults, state }) {
  if (!testResults) {
    return (
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 text-center shadow-xl">
        <span className="text-2xl">🧪</span>
        <h3 className="mt-2 text-sm font-semibold text-zinc-200">
          Job 3: Self-Testing & Verification Suite
        </h3>
        <p className="mt-1 text-xs text-zinc-400">
          Automated test execution results will appear here once the worker finishes Job 2 (Execution).
        </p>
      </div>
    );
  }

  const passed = testResults.passed ?? 0;
  const failed = testResults.failed ?? 0;
  const total = testResults.total ?? (passed + failed);
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 100;
  const isSuccess = failed === 0 && (testResults.exit_code === 0 || testResults.exit_code === undefined);

  return (
    <div className="rounded-2xl border border-emerald-900/50 bg-gradient-to-br from-emerald-950/30 via-zinc-900/90 to-zinc-950/90 p-5 sm:p-6 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-700/50 bg-emerald-900/60 text-base font-bold text-emerald-200 shadow-inner">
            🧪
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                Self-Testing & Verification Results
              </h3>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                Job 3 of 3
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Worker self-verification and test execution suite
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            isSuccess
              ? "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
              : "border-red-500/50 bg-red-950/80 text-red-300"
          }`}
        >
          <span>{isSuccess ? "✓ ALL TESTS PASSED" : "✗ TEST FAILURES DETECTED"}</span>
        </span>
      </div>

      {/* Metrics Row */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Pass Rate
          </span>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-400">{passRate}%</p>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Passed / Total
          </span>
          <p className="mt-1 font-mono text-lg font-bold text-zinc-200">
            {passed} / {total}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Failed Tests
          </span>
          <p
            className={`mt-1 font-mono text-lg font-bold ${
              failed > 0 ? "text-red-400" : "text-zinc-400"
            }`}
          >
            {failed}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Test Runner
          </span>
          <p className="mt-1 truncate font-mono text-xs font-semibold text-purple-300">
            {testResults.framework || "pytest"}
          </p>
        </div>
      </div>

      {/* Output details / logs */}
      {(testResults.output || testResults.details) && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Execution Log
          </p>
          <pre className="max-h-60 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950 p-3.5 font-mono text-xs text-zinc-300 whitespace-pre-wrap">
            {testResults.output || JSON.stringify(testResults.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}