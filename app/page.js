"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { UserBubble, BotMessage } from "./components/Chat";
import VoiceInput from "./components/VoiceInput";
import ActivityFeed from "./components/ActivityFeed";
import TaskChainTracker from "./components/TaskChainTracker";
import PowerControls from "./components/PowerControls";

import { API_URL, apiFetch } from "./lib/api";
const CHAT_STORAGE_KEY = "jarvis_chat_messages";

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadStoredMessages() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m) => m && !m.thinking);
  } catch {
    return [];
  }
}

const SUGGESTIONS = [
  { label: "⚡ Fork Coding Task", prompt: "fork the task: implement user auth endpoints and tests" },
  { label: "📂 List files", prompt: "list files in D:/Ai automation backend" },
  { label: "✉️ Recent emails", prompt: "list my recent emails" },
  { label: "💬 WhatsApp chats", prompt: "list my whatsapp chats" },
];

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);
  const [confirmedPlanIds, setConfirmedPlanIds] = useState(new Set());
  const [showFeed, setShowFeed] = useState(false);
  const [showChainMobile, setShowChainMobile] = useState(false);
  const endRef = useRef(null);

  // Load stored messages after mount to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    setMessages(loadStoredMessages());
  }, []);

  // Check backend health
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await apiFetch("/health");
        if (res.ok) {
          const data = await res.json().catch(() => null);
          setBackendOnline(Boolean(data && data.status === "ok"));
        } else {
          setBackendOnline(false);
        }
      } catch {
        setBackendOnline(false);
      }
    }
    checkHealth();
    const id = setInterval(checkHealth, 10000);
    return () => clearInterval(id);
  }, []);

  // Keep chat across reloads
  useEffect(() => {
    if (!mounted) return;
    try {
      window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // storage full
    }
  }, [messages, mounted]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function callAgent(body) {
    const res = await apiFetch("/agent/run", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
    return data;
  }

  async function sendPrompt(text) {
    const prompt = text.trim();
    if (!prompt || busy) return;

    const botId = generateId();
    setMessages((m) => [
      ...m,
      { id: generateId(), role: "user", content: prompt, prompt },
      { id: botId, role: "bot", prompt, thinking: true },
    ]);
    setInput("");
    setBusy(true);

    try {
      const result = await callAgent({ prompt });
      setMessages((m) =>
        m.map((msg) =>
          msg.id === botId ? { ...msg, thinking: false, data: result } : msg
        )
      );
    } catch (e) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === botId ? { ...msg, thinking: false, error: e.message } : msg
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmPlan(prompt, planId) {
    if (busy || confirmedPlanIds.has(planId)) return;
    setBusy(true);
    setConfirmedPlanIds((prev) => new Set([...prev, planId]));

    const botId = generateId();
    setMessages((m) => [...m, { id: botId, role: "bot", prompt, thinking: true }]);

    try {
      const result = await callAgent({ prompt, confirm: true, plan_id: planId });
      setMessages((m) =>
        m.map((msg) =>
          msg.id === botId ? { ...msg, thinking: false, data: result } : msg
        )
      );
    } catch (e) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === botId ? { ...msg, thinking: false, error: e.message } : msg
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function newChat() {
    setMessages([]);
    setConfirmedPlanIds(new Set());
    try {
      window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
      // Persistent brain memory is preserved in JARVIS_MEMORY.md across visual chat resets
    } catch {
      // best effort
    }
  }

  const [launchingTerminal, setLaunchingTerminal] = useState(false);

  async function openOpenCodeTerminal() {
    setLaunchingTerminal(true);
    try {
      await apiFetch("/workers/open-terminal", {
        method: "POST",
        body: JSON.stringify({ directory: "D:/workspace" }),
      });
    } catch {
      /* ignore */
    } finally {
      setLaunchingTerminal(false);
    }
  }

  // Extract the active plan and ensure planExecution belongs only to this active plan
  const activePlanMessage = [...messages].reverse().find(
    (m) => m.role === "bot" && (m.data?.mode === "plan" || (m.data?.steps && m.data.steps.length > 0))
  );
  const activePlan = activePlanMessage?.data || null;

  const matchingExecutionMessage = activePlan
    ? [...messages].reverse().find(
        (m) =>
          m.role === "bot" &&
          m.data?.mode === "execution" &&
          messages.indexOf(m) > messages.indexOf(activePlanMessage)
      )
    : null;
  const planExecution = matchingExecutionMessage?.data || null;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100 selection:bg-purple-500/30 selection:text-purple-200">
      <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-zinc-800/80 bg-zinc-900/50 px-3.5 py-2.5 sm:px-6 sm:py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-md shadow-purple-950/40 shrink-0">
            <span className="text-xs sm:text-sm font-bold tracking-wider text-white">J</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight">Jarvis Assistant</h1>
              <span
                className={`flex h-2 w-2 rounded-full ${
                  backendOnline === null
                    ? "bg-zinc-500"
                    : backendOnline
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]"
                }`}
                title={backendOnline ? "Backend online" : "Backend offline"}
              />
              <span className="hidden sm:inline-block rounded-full border border-sky-800/50 bg-sky-950/60 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                🌌 Antigravity Brain
              </span>
            </div>
            <p className="hidden xs:block text-[11px] sm:text-xs text-zinc-400">Living Memory & Agent Orchestrator</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
          <PowerControls />
          {activePlan && (
            <button
              onClick={() => setShowChainMobile((prev) => !prev)}
              className="lg:hidden inline-flex items-center gap-1 rounded-xl border border-purple-500/50 bg-purple-950/70 px-2.5 py-1 text-xs font-semibold text-purple-300 shadow-sm"
            >
              <span>🔗</span>
              <span>Chain</span>
            </button>
          )}
          <button
            onClick={() => setShowFeed((prev) => !prev)}
            className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs font-semibold shadow-sm transition ${
              showFeed
                ? "border-purple-500 bg-purple-950/80 text-purple-200 shadow-purple-950/50"
                : "border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-purple-700/60 hover:text-white"
            }`}
          >
            <span>📡</span>
            <span className="hidden sm:inline">Activity Feed</span>
            <span className="sm:hidden">Feed</span>
          </button>
          <button
            onClick={openOpenCodeTerminal}
            disabled={launchingTerminal}
            className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border border-sky-700/60 bg-sky-950/60 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs font-semibold text-sky-300 shadow-sm transition hover:border-sky-500 hover:bg-sky-900/60 hover:text-white disabled:opacity-40"
          >
            <span>💻</span>
            <span className="hidden sm:inline">{launchingTerminal ? "Opening..." : "Open Terminal"}</span>
            <span className="sm:hidden">CLI</span>
          </button>
          <button
            onClick={newChat}
            disabled={busy}
            title="Clear current screen (brain memory is retained)"
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
          >
            <span className="hidden sm:inline">✨ New Chat</span>
            <span className="sm:hidden">✨ New</span>
          </button>
          <Link
            href="/workers"
            className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border border-purple-800/60 bg-purple-950/40 px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-xs font-medium text-purple-300 shadow-sm transition hover:border-purple-600 hover:bg-purple-900/50 hover:text-white"
          >
            <span>⚡ Workers</span>
            <span className="hidden sm:inline">→</span>
          </Link>
        </div>
      </header>

      {/* Main Workspace Layout (Left: Task Chain Stepper | Right/Center: Chat) */}
      <div className="flex flex-1 overflow-hidden relative">
        <TaskChainTracker
          activePlan={activePlan}
          planExecution={planExecution}
          isOpenMobile={showChainMobile}
          onCloseMobile={() => setShowChainMobile(false)}
        />

        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center pt-8 sm:pt-16 text-center px-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-800/40 bg-purple-950/30 text-purple-300 shadow-inner">
                  ⚡
                </div>
                <h2 className="mt-4 text-sm sm:text-base font-semibold text-white">How can Jarvis assist you today?</h2>
                <p className="mt-1 text-xs text-zinc-400 max-w-sm">
                  Ask anything, run file automation, send emails, or delegate complex tasks to specialized background workers.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => sendPrompt(s.prompt)}
                      className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-purple-700/60 hover:bg-zinc-800/80 hover:text-white"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) =>
                msg.role === "user" ? (
                  <UserBubble key={msg.id} content={msg.content || msg.prompt} />
                ) : (
                  <BotMessage
                    key={msg.id}
                    msg={msg}
                    onConfirm={(prompt, planId) => confirmPlan(prompt, planId)}
                  />
                )
              )
            )}
            <div ref={endRef} />
          </div>
        </div>
      </div>

      <footer className="border-t border-zinc-800/80 bg-zinc-900/40 p-2.5 sm:p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-2 sm:gap-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendPrompt(input)}
            placeholder='Ask Jarvis or click 🎙️ / Alt+V...'
            disabled={busy}
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 sm:px-4 py-2 sm:py-2.5 text-base sm:text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-purple-600/70 focus:ring-1 focus:ring-purple-600/50 disabled:opacity-50"
          />
          <VoiceInput
            disabled={busy}
            onTranscriptInsert={(text) => {
              setInput((prev) => (prev ? `${prev} ${text}` : text));
            }}
            onAutoSend={(text) => {
              sendPrompt(text);
            }}
          />
          <button
            onClick={() => sendPrompt(input)}
            disabled={busy || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-purple-950/40 transition hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 shrink-0"
          >
            Send
          </button>
        </div>
      </footer>

      {/* Real-time Activity Feed Drawer */}
      <ActivityFeed isOpen={showFeed} onClose={() => setShowFeed(false)} />
    </div>
  );
}