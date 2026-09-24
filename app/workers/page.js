"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { API_URL, apiFetch } from "../lib/api";
import PowerControls from "../components/PowerControls";

const STATUS_STYLE = {
  running: "border-sky-700/60 bg-sky-950/60 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.2)]",
  awaiting_plan_approval: "border-amber-500/80 bg-amber-950/80 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.35)] ring-1 ring-amber-500/40",
  completed: "border-emerald-700/60 bg-emerald-950/60 text-emerald-300",
  cancelled: "border-amber-700/60 bg-amber-950/60 text-amber-300",
  idle: "border-zinc-700 bg-zinc-800 text-zinc-400",
};

function ForkForm() {
  const router = useRouter();
  const [objective, setObjective] = useState("");
  const [fsScope, setFsScope] = useState("D:/workspace");
  const [workerType, setWorkerType] = useState("antigravity_worker");
  const [model, setModel] = useState("gemini-3.8-flash-medium");
  const [customModel, setCustomModel] = useState("");
  const [maxSteps, setMaxSteps] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    try {
      const savedScope = window.localStorage.getItem("jarvis_workspace_scope");
      if (savedScope) {
        setFsScope(savedScope);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function handleScopeChange(val) {
    setFsScope(val);
    try {
      window.localStorage.setItem("jarvis_workspace_scope", val);
    } catch {
      /* ignore */
    }
  }

  function applyPreset(type) {
    if (type === "implement") {
      setObjective("Implement new feature, write clean code, and verify tests pass");
    } else if (type === "refactor") {
      setObjective("Refactor code module to improve structure and maintain existing tests");
    } else if (type === "files") {
      setObjective("Inspect directory structure and check file existence");
    }
  }

  const effectiveModel = model === "custom" ? customModel.trim() : model;

  async function submit(e) {
    e.preventDefault();
    if (!objective.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const scopeVal = fsScope.trim() || "D:/workspace";
      try {
        window.localStorage.setItem("jarvis_workspace_scope", scopeVal);
      } catch {}
      const res = await apiFetch("/workers/fork", {
        method: "POST",
        body: JSON.stringify({
          objective: objective.trim(),
          worker_type: workerType,
          model: effectiveModel || undefined,
          fs_scope: scopeVal,
          max_steps: Math.max(1, Number(maxSteps) || 20),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      router.push(`/worker/${data.session_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/80 shadow-xl backdrop-blur-md">
      <div
        className="flex cursor-pointer items-center justify-between border-b border-zinc-800/60 p-4 transition hover:bg-zinc-800/30"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-950/80 text-purple-300 border border-purple-800/50 text-xs font-bold">
            ⚡
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Fork a New Background Worker</h2>
            <p className="text-xs text-zinc-400">
              Spin up an isolated autonomous worker with strict scope & allowed tools
            </p>
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400 transition hover:text-white"
        >
          {isOpen ? "Collapse" : "Expand Form"}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={submit} className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-400">Quick Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset("implement")}
              className="rounded-lg border border-sky-800/50 bg-sky-950/40 px-2.5 py-1 text-xs font-medium text-sky-300 transition hover:bg-sky-900/50"
            >
              ✨ Implement Feature
            </button>
            <button
              type="button"
              onClick={() => applyPreset("refactor")}
              className="rounded-lg border border-purple-800/50 bg-purple-950/30 px-2.5 py-1 text-xs font-medium text-purple-300 transition hover:bg-purple-900/40"
            >
              🛠️ Refactor Module
            </button>
            <button
              type="button"
              onClick={() => applyPreset("files")}
              className="rounded-lg border border-zinc-700 bg-zinc-800/40 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
            >
              📁 File Inspection
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-300">Task Objective</label>
              <input
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder='e.g. "Implement user authentication endpoints and write unit tests"'
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-purple-600/70 focus:ring-1 focus:ring-purple-600/40"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300">Filesystem Scope (`fs_scope` boundary)</label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-zinc-500">Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleScopeChange("D:/workspace")}
                    className={`rounded px-1.5 py-0.5 font-mono transition ${
                      fsScope === "D:/workspace"
                        ? "bg-purple-900/60 text-purple-200 border border-purple-700/60"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScopeChange("D:/AI-Automation")}
                    className={`rounded px-1.5 py-0.5 font-mono transition ${
                      fsScope === "D:/AI-Automation"
                        ? "bg-purple-900/60 text-purple-200 border border-purple-700/60"
                        : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    AI-Automation
                  </button>
                </div>
              </div>
              <input
                value={fsScope}
                onChange={(e) => handleScopeChange(e.target.value)}
                placeholder="Absolute path boundary the worker is restricted to"
                className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-2 font-mono text-xs text-zinc-200 outline-none transition focus:border-purple-600/70"
              />
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className="text-purple-400">🤝</span>
                <span>
                  Workers in this scope automatically inherit prior <span className="font-mono text-zinc-300">SESSION_HANDOVER.md</span> and AST <span className="font-mono text-zinc-300">graphify</span> graphs.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-zinc-300">Worker Engine</label>
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWorkerType("antigravity_worker")}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-semibold transition ${
                      workerType === "antigravity_worker"
                        ? "border-sky-500 bg-sky-950/60 text-sky-200 shadow-sm shadow-sky-950/40"
                        : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <span>🌌</span>
                    <span>Antigravity (agy CLI)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkerType("opencode_worker")}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-semibold transition ${
                      workerType === "opencode_worker"
                        ? "border-purple-500 bg-purple-950/60 text-purple-200 shadow-sm shadow-purple-950/40"
                        : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <span>⚡</span>
                    <span>OpenCode CLI</span>
                  </button>
                </div>
              </div>

              {workerType === "antigravity_worker" ? (
                <div>
                  <label className="text-xs font-medium text-zinc-300">Model Selection</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-2 font-mono text-xs text-zinc-200 outline-none transition focus:border-sky-500/70"
                  >
                    <optgroup label="── Gemini 3.8 ──" className="bg-zinc-900 text-zinc-300 font-sans">
                      <option value="gemini-3.8-flash-low">Gemini 3.8 Flash (Low)</option>
                      <option value="gemini-3.8-flash-medium">Gemini 3.8 Flash (Medium)</option>
                      <option value="gemini-3.8-flash-high">Gemini 3.8 Flash (High)</option>
                    </optgroup>
                    <optgroup label="── Gemini 3.7 ──" className="bg-zinc-900 text-zinc-300 font-sans">
                      <option value="gemini-3.7-flash-low">Gemini 3.7 Flash (Low)</option>
                      <option value="gemini-3.7-flash-medium">Gemini 3.7 Flash (Medium)</option>
                      <option value="gemini-3.7-flash-high">Gemini 3.7 Flash (High)</option>
                    </optgroup>
                    <optgroup label="── Gemini 3.6 ──" className="bg-zinc-900 text-zinc-300 font-sans">
                      <option value="gemini-3.6-flash-low">Gemini 3.6 Flash (Low)</option>
                      <option value="gemini-3.6-flash-medium">Gemini 3.6 Flash (Medium)</option>
                      <option value="gemini-3.6-flash-high">Gemini 3.6 Flash (High)</option>
                    </optgroup>
                    <optgroup label="── Gemini 3.1 Pro ──" className="bg-zinc-900 text-zinc-300 font-sans">
                      <option value="gemini-3.1-pro-low">Gemini 3.1 Pro (Low)</option>
                      <option value="gemini-3.1-pro-high">Gemini 3.1 Pro (High)</option>
                    </optgroup>
                    <optgroup label="── Claude ──" className="bg-zinc-900 text-zinc-300 font-sans">
                      <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Thinking)</option>
                      <option value="claude-opus-4-6-thinking">Claude Opus 4.6 (Thinking)</option>
                    </optgroup>
                    <optgroup label="── Open-Source ──" className="bg-zinc-900 text-zinc-300 font-sans">
                      <option value="gpt-oss-120b-medium">GPT-OSS 120B (Medium)</option>
                      <option value="custom">Custom Model ID...</option>
                    </optgroup>
                  </select>
                  {model === "custom" && (
                    <input
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="e.g. meta-llama/llama-3.1-405b"
                      className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-sky-500"
                    />
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-purple-900/40 bg-purple-950/20 p-3 flex flex-col justify-center">
                  <p className="text-xs font-semibold text-purple-200 flex items-center gap-1.5">
                    <span>⚡</span> OpenCode Default Model
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    OpenCode operates with its single configured native model.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/60 pt-4">
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              Max Steps
              <input
                type="number"
                min={1}
                max={50}
                value={maxSteps}
                onChange={(e) => setMaxSteps(e.target.value)}
                className="w-20 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-mono text-white outline-none focus:border-purple-500"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !objective.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-purple-950/40 transition hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40"
            >
              {busy ? "Forking..." : "⚡ Launch Worker"}
            </button>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 p-2.5 text-xs text-red-400">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [launchingTerminal, setLaunchingTerminal] = useState(false);
  const [terminalMsg, setTerminalMsg] = useState(null);
  const [clearing, setClearing] = useState(false);

  async function clearAllWorkers() {
    if (!confirm("Are you sure you want to clear all worker sessions and history?")) return;
    setClearing(true);
    try {
      const res = await apiFetch("/workers", { method: "DELETE" });
      if (res.ok) {
        setWorkers([]);
      }
    } catch {
      /* ignore */
    } finally {
      setClearing(false);
    }
  }

  async function openOpenCodeTerminal(dir = "D:/Ai automation backend") {
    setLaunchingTerminal(true);
    setTerminalMsg(null);
    try {
      const res = await apiFetch("/workers/open-terminal", {
        method: "POST",
        body: JSON.stringify({ directory: dir }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setTerminalMsg(data.message || "✓ OpenCode CLI window launched on your desktop!");
      setTimeout(() => setTerminalMsg(null), 5000);
    } catch (e) {
      setTerminalMsg(`Failed: ${e.message}`);
      setTimeout(() => setTerminalMsg(null), 5000);
    } finally {
      setLaunchingTerminal(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await apiFetch("/workers/list");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setWorkers(data.workers || []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    return workers.filter((w) => {
      const matchesStatus = filterStatus === "all" || w.status === filterStatus;
      const text = `${w.session_id} ${w.objective || ""}`.toLowerCase();
      const matchesSearch = !search || text.includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [workers, filterStatus, search]);

  const runningCount = workers.filter((w) => w.status === "running").length;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-800/80 bg-zinc-900/50 px-3.5 py-2.5 sm:px-6 sm:py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-md shadow-purple-950/40 shrink-0">
            <span className="text-xs sm:text-sm font-bold text-white">⚡</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight">Worker Sessions</h1>
              {runningCount > 0 && (
                <span className="flex items-center gap-1.5 rounded-full border border-sky-800/60 bg-sky-950/60 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-sky-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
                  {runningCount} active
                </span>
              )}
            </div>
            <p className="hidden xs:block text-[11px] sm:text-xs text-zinc-400">
              Real-time monitoring and management of delegated tasks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PowerControls />
          <button
            onClick={() => openOpenCodeTerminal()}
            disabled={launchingTerminal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-700/60 bg-sky-950/60 px-3 py-1.5 text-xs font-semibold text-sky-300 shadow-sm transition hover:border-sky-500 hover:bg-sky-900/60 hover:text-white disabled:opacity-40"
          >
            <span>💻</span>
            <span className="hidden sm:inline">{launchingTerminal ? "Opening..." : "Open OpenCode CLI"}</span>
            <span className="sm:hidden">CLI</span>
          </button>
          <Link
            href="/"
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
          >
            ← Chat
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-6">
        <div className="mx-auto max-w-4xl">
          {terminalMsg && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-sky-800/60 bg-sky-950/60 p-3.5 text-xs font-medium text-sky-200 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span>💻</span>
                <span>{terminalMsg}</span>
              </div>
              <button
                onClick={() => setTerminalMsg(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-xs text-red-300">
              Cannot reach backend at {API_URL}: {error}
            </div>
          )}

          {/* Direct Launch OpenCode Hero Card */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-sky-800/50 bg-gradient-to-r from-sky-950/30 to-indigo-950/20 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-900/60 border border-sky-700/50 text-sky-300 text-lg shadow-inner shrink-0">
                💻
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Direct OpenCode Interactive CLI</h3>
                <p className="text-xs text-zinc-400">Launch a live terminal window on your desktop to chat with OpenCode directly.</p>
              </div>
            </div>
            <button
              onClick={() => openOpenCodeTerminal()}
              disabled={launchingTerminal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-sky-950/40 transition hover:from-sky-500 hover:to-indigo-500 disabled:opacity-40 w-full sm:w-auto"
            >
              <span>▶</span>
              <span>{launchingTerminal ? "Opening..." : "Launch OpenCode on Desktop"}</span>
            </button>
          </div>

          <ForkForm />

          {/* List Controls */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1 overflow-x-auto scrollbar-none max-w-full">
              {[
                { id: "all", label: "All" },
                { id: "running", label: "Running" },
                { id: "awaiting_plan_approval", label: "⚠️ Awaiting Approval" },
                { id: "completed", label: "Completed" },
                { id: "cancelled", label: "Cancelled" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setFilterStatus(st.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition shrink-0 ${
                    filterStatus === st.id
                      ? st.id === "awaiting_plan_approval"
                        ? "bg-amber-950/80 text-amber-200 border border-amber-600/60 shadow-sm"
                        : "bg-purple-950/80 text-purple-200 border border-purple-800/50 shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workers..."
                className="flex-1 sm:w-48 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-purple-600/60"
              />
              <button
                onClick={clearAllWorkers}
                disabled={clearing || workers.length === 0}
                className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-red-900/50 hover:bg-red-950/30 hover:text-red-300 disabled:opacity-30 shrink-0"
              >
                <span>🗑️</span>
                <span className="hidden xs:inline">{clearing ? "Clearing..." : "Clear History"}</span>
              </button>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="my-16 text-center text-zinc-500 text-xs">
              {workers.length === 0
                ? "No worker sessions yet. Use the form above or tell the chat agent to 'fork a task'."
                : "No worker sessions matching the filter."}
            </div>
          )}

          <div className="space-y-3">
            {filtered.map((w) => {
              const isAwaiting = w.status === "awaiting_plan_approval";
              return (
                <Link
                  key={w.session_id}
                  href={`/worker/${w.session_id}`}
                  className={`group block rounded-2xl border p-3.5 sm:p-4 shadow-md transition ${
                    isAwaiting
                      ? "border-amber-500/70 bg-gradient-to-r from-amber-950/30 via-zinc-900/90 to-zinc-900/80 hover:border-amber-400"
                      : "border-zinc-800/80 bg-zinc-900/70 hover:border-purple-800/50 hover:bg-zinc-900/95"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-md border border-purple-900/60 bg-purple-950/50 px-2 py-0.5 font-mono text-[11px] font-semibold text-purple-300">
                          {w.session_id}
                        </span>
                        <h3 className="truncate text-xs sm:text-sm font-semibold text-white group-hover:text-purple-200 transition">
                          {w.objective || "Untitled Worker Task"}
                        </h3>
                      </div>

                      <p className="mt-1.5 text-xs text-zinc-400">
                        {w.completed?.length ?? 0} completed · {w.errors?.length ?? 0} errors
                        {w.current_step ? (
                          <span className="text-sky-400 font-medium"> · active: {w.current_step}</span>
                        ) : ""}
                      </p>

                      {isAwaiting && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-950/60 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                          <span>Implementation Plan Ready — Click to Review & Approve →</span>
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-2.5 pt-2 sm:pt-0 border-t border-zinc-800/50 sm:border-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider ${
                          STATUS_STYLE[w.status] || STATUS_STYLE.idle
                        }`}
                      >
                        {w.status === "running" && (
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
                        )}
                        {isAwaiting && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        )}
                        {isAwaiting ? "Awaiting Plan Approval" : w.status}
                      </span>

                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 sm:w-24 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-sky-400 transition-all duration-300"
                            style={{ width: `${w.progress_percent ?? 0}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] sm:text-[11px] text-zinc-400">
                          {w.progress_percent ?? 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}