"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

import { API_URL } from "../lib/api";

function formatTimestamp(ts) {
  if (!ts) return "";
  if (typeof ts === "string") {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
    }
  }
  const d = new Date(typeof ts === "number" && ts < 10000000000 ? ts * 1000 : ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ActivityFeed({ isOpen, onClose }) {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("stream"); // "stream" | "digests"
  const [digests, setDigests] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({ whatsapp: 0, gmail: 0, drive: 0 });
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef(null);

  // 1. Initial fetch of persistent 24h feed & unread counts from backend
  useEffect(() => {
    async function loadFeed() {
      try {
        const [feedRes, unreadRes] = await Promise.all([
          fetch(`${API_URL}/events/feed?hours=24&limit=50`),
          fetch(`${API_URL}/events/unread-counts`),
        ]);
        if (feedRes.ok) {
          const feedData = await feedRes.json();
          const normalized = feedData.map((item) => ({
            id: item.id,
            event_type: `${item.service.toUpperCase()}_INBOUND_DIGEST`,
            title: item.title || item.sender || "Update",
            summary: item.snippet || item.title || "",
            timestamp: item.timestamp,
            data: {
              sender: item.sender,
              unread: item.is_unread ? 1 : 0,
            },
          }));
          setEvents((prev) => {
            const map = new Map();
            [...normalized, ...prev].forEach((e) => map.set(e.id, e));
            return Array.from(map.values()).slice(0, 100);
          });
        }
        if (unreadRes.ok) {
          const uData = await unreadRes.json();
          setUnreadCounts(uData);
        }
      } catch (err) {
        // Backend feed fetch error handled gracefully
      }
    }
    loadFeed();
  }, [isOpen]);

  // 2. Fetch 7-day memory digests when switching to digests view
  useEffect(() => {
    if (viewMode === "digests") {
      fetch(`${API_URL}/events/7day-digests?days=7`)
        .then((r) => r.json())
        .then((data) => setDigests(data))
        .catch(() => setDigests([]));
    }
  }, [viewMode]);

  // 3. SSE Live stream connection
  useEffect(() => {
    let es;
    function connect() {
      es = new EventSource(`${API_URL}/events/stream`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.onmessage = (e) => {
        try {
          const raw = e.data;
          if (!raw || raw.startsWith(":")) return; // ping
          const evt = JSON.parse(raw);

          setEvents((prev) => {
            // Deduplicate by ID
            if (prev.some((item) => item.id === evt.id)) return prev;
            return [evt, ...prev].slice(0, 100);
          });

          if (!isOpen) {
            setUnreadCount((c) => c + 1);
          }
        } catch {
          // ignore parse errors on keepalive
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Reconnect after 4s
        setTimeout(connect, 4000);
      };
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const filteredEvents = events.filter((evt) => {
    if (filter === "all") return true;
    if (filter === "unread") return evt.data?.unread > 0 || evt.is_unread;
    if (filter === "whatsapp") return evt.event_type?.includes("WHATSAPP");
    if (filter === "gmail") return evt.event_type?.includes("GMAIL");
    if (filter === "drive") return evt.event_type?.includes("DRIVE");
    if (filter === "workers") return evt.event_type?.includes("WORKER");
    if (filter === "actions") return evt.event_type?.includes("AUTONOMOUS") || evt.event_type?.includes("TASK_CHAIN");
    return true;
  });

  const getEventBadge = (evt) => {
    const type = evt.event_type || "";
    if (type.includes("WHATSAPP")) {
      return { icon: "💬", label: "WhatsApp", bg: "bg-emerald-950/60 border-emerald-700/50 text-emerald-300" };
    }
    if (type.includes("GMAIL")) {
      return { icon: "✉️", label: "Gmail", bg: "bg-amber-950/60 border-amber-700/50 text-amber-300" };
    }
    if (type.includes("DRIVE")) {
      return { icon: "📁", label: "Drive", bg: "bg-blue-950/60 border-blue-700/50 text-blue-300" };
    }
    if (type.includes("WORKER_COMPLETED")) {
      return { icon: "✅", label: "Worker Succeeded", bg: "bg-purple-950/60 border-purple-700/50 text-purple-300" };
    }
    if (type.includes("WORKER_STEP")) {
      return { icon: "⚡", label: "Worker Step", bg: "bg-indigo-950/60 border-indigo-700/50 text-indigo-300" };
    }
    if (type.includes("WORKER")) {
      return { icon: "⚙️", label: "Worker", bg: "bg-purple-950/60 border-purple-700/50 text-purple-300" };
    }
    if (type.includes("AUTONOMOUS") || type.includes("TASK_CHAIN")) {
      return { icon: "🤖", label: "Chained Action", bg: "bg-cyan-950/60 border-cyan-700/50 text-cyan-300" };
    }
    return { icon: "🔔", label: "Event", bg: "bg-zinc-800/60 border-zinc-700/50 text-zinc-300" };
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-in-out sm:w-96 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-sm text-sm">
              📡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-tight">Multi-Service Feed</h2>
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)] animate-pulse"
                  }`}
                  title={connected ? "Connected to live SSE stream" : "Reconnecting..."}
                />
              </div>
              <p className="text-[10px] text-zinc-400">24-Hour Stream & 7-Day Memory</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === "stream" ? "digests" : "stream")}
              className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition ${
                viewMode === "digests"
                  ? "bg-purple-600 text-white border-purple-500"
                  : "bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
              }`}
            >
              {viewMode === "digests" ? "⚡ Live Feed" : "🧠 7-Day Memory"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              aria-label="Close activity feed"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Ambient Unread Badges Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/60 border-b border-zinc-800/60 text-[11px]">
          <span className="text-zinc-400">Unread (24h):</span>
          <div className="flex items-center gap-2 font-mono">
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${unreadCounts.whatsapp > 0 ? "bg-emerald-950 text-emerald-300 border border-emerald-800/50" : "text-zinc-500"}`}>
              💬 {unreadCounts.whatsapp || 0}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${unreadCounts.gmail > 0 ? "bg-amber-950 text-amber-300 border border-amber-800/50" : "text-zinc-500"}`}>
              ✉️ {unreadCounts.gmail || 0}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${unreadCounts.drive > 0 ? "bg-blue-950 text-blue-300 border border-blue-800/50" : "text-zinc-500"}`}>
              📁 {unreadCounts.drive || 0}
            </span>
          </div>
        </div>

        {viewMode === "stream" ? (
          <>
            {/* Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-zinc-800/60 px-3 py-2 bg-zinc-900/20 text-xs scrollbar-none">
              {[
                { id: "all", label: "All" },
                { id: "unread", label: "🔴 Unread" },
                { id: "whatsapp", label: "💬 WhatsApp" },
                { id: "gmail", label: "✉️ Gmail" },
                { id: "drive", label: "📁 Drive" },
                { id: "workers", label: "⚡ Workers" },
                { id: "actions", label: "🤖 Actions" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    filter === tab.id
                      ? "bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Events List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500">
                  <span className="text-2xl mb-1">📡</span>
                  <p className="text-xs">No activity yet in this filter.</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Events from WhatsApp, Gmail, Drive, and Workers stream here live.</p>
                </div>
              ) : (
                filteredEvents.map((evt) => {
                  const badge = getEventBadge(evt);
                  const isWhatsApp = evt.event_type?.includes("WHATSAPP");
                  const isGmail = evt.event_type?.includes("GMAIL");
                  const isDrive = evt.event_type?.includes("DRIVE");
                  const isAction = evt.event_type?.includes("AUTONOMOUS") || evt.event_type?.includes("TASK_CHAIN");
                  const sessionId = evt.data?.session_id || evt.metadata?.session_id;

                  return (
                    <div
                      key={evt.id}
                      className="group relative rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 shadow-sm hover:border-zinc-700 transition"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${badge.bg}`}>
                            <span>{badge.icon}</span>
                            <span>{badge.label}</span>
                          </span>
                          {sessionId && (
                            <Link
                              href={`/worker/${sessionId}`}
                              className="text-[10px] font-mono text-purple-400 hover:text-purple-300 hover:underline"
                              title="View Worker Session"
                            >
                              [{sessionId.slice(0, 8)}]
                            </Link>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {formatTimestamp(evt.timestamp)}
                        </span>
                      </div>

                      <h3 className="text-xs font-semibold text-zinc-100 line-clamp-1 mb-1">
                        {evt.title}
                      </h3>

                      <p className="text-xs text-zinc-300/90 leading-relaxed break-words">
                        {evt.summary}
                      </p>

                      {/* Additional contextual chips */}
                      {isWhatsApp && evt.data?.unread > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            ● {evt.data.unread} unread
                          </span>
                        </div>
                      )}

                      {isGmail && evt.data?.sender && (
                        <div className="mt-1.5 text-[11px] text-zinc-400 truncate">
                          <span className="text-zinc-500">From:</span> {evt.data.sender}
                        </div>
                      )}

                      {isDrive && evt.data?.owner && (
                        <div className="mt-1.5 text-[11px] text-zinc-400 truncate">
                          <span className="text-zinc-500">Updated by:</span> {evt.data.owner}
                        </div>
                      )}

                      {isAction && evt.data?.tool && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-cyan-300 bg-cyan-950/30 border border-cyan-800/40 rounded-lg px-2 py-1">
                          <span>⚡ Action Tool:</span>
                          <span className="font-mono font-semibold">{evt.data.tool}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* 7-Day Memory Digests View */
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="rounded-lg bg-purple-950/30 border border-purple-800/40 p-2.5 text-xs text-purple-200">
              <span className="font-semibold">🧠 7-Day Temporal Digests</span>
              <p className="text-[11px] text-purple-300/80 mt-0.5">
                Summarized contextual memory across your WhatsApp, Gmail, and Google Drive.
              </p>
            </div>

            {digests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500">
                <span className="text-2xl mb-1">🧠</span>
                <p className="text-xs">No 7-day memory digests compiled yet.</p>
                <p className="text-[10px] text-zinc-600 mt-1">Digests are automatically compiled hourly from incoming interactions.</p>
              </div>
            ) : (
              digests.map((dg) => (
                <div key={dg.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-zinc-200 uppercase tracking-wider">{dg.service}</span>
                    <span className="font-mono text-zinc-500">{dg.date}</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{dg.summary}</p>
                  {dg.contacts && dg.contacts.length > 0 && (
                    <div className="text-[10px] text-zinc-400">
                      <span className="text-zinc-500 font-semibold">Contacts:</span> {dg.contacts.join(", ")}
                    </div>
                  )}
                  {dg.action_items && dg.action_items.length > 0 && (
                    <div className="text-[10px] text-amber-300/90 bg-amber-950/20 border border-amber-800/30 rounded p-1.5">
                      <span className="font-semibold">Action items:</span> {dg.action_items.join("; ")}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-zinc-800/80 px-4 py-2.5 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-500">
          <span>{viewMode === "stream" ? `${filteredEvents.length} events logged` : `${digests.length} digests stored`}</span>
          {events.length > 0 && viewMode === "stream" && (
            <button
              onClick={() => setEvents([])}
              className="hover:text-zinc-300 transition text-[11px]"
            >
              Clear view
            </button>
          )}
        </div>
      </div>
    </>
  );
}

