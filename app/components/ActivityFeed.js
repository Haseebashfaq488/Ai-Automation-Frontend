"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

import { API_URL } from "../lib/api";

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(typeof ts === "number" && ts < 10000000000 ? ts * 1000 : ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ActivityFeed({ isOpen, onClose }) {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef(null);

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
    if (filter === "whatsapp") return evt.event_type?.includes("WHATSAPP");
    if (filter === "gmail") return evt.event_type?.includes("GMAIL");
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
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3.5 bg-zinc-900/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-sm text-sm">
            📡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white tracking-tight">Live Activity Feed</h2>
              <span
                className={`h-2 w-2 rounded-full ${
                  connected
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)] animate-pulse"
                }`}
                title={connected ? "Connected to live SSE stream" : "Reconnecting..."}
              />
            </div>
            <p className="text-[11px] text-zinc-400">Real-time digests & event triggers</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          aria-label="Close activity feed"
        >
          ✕
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-800/60 px-3 py-2 bg-zinc-900/20 text-xs scrollbar-none">
        {[
          { id: "all", label: "All" },
          { id: "whatsapp", label: "💬 WhatsApp" },
          { id: "gmail", label: "✉️ Gmail" },
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
            <p className="text-[10px] text-zinc-600 mt-1">Events from WhatsApp, Gmail, and Workers stream here live.</p>
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const badge = getEventBadge(evt);
            const isWhatsApp = evt.event_type?.includes("WHATSAPP");
            const isGmail = evt.event_type?.includes("GMAIL");
            const isWorker = evt.event_type?.includes("WORKER");
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

      {/* Footer / Clear */}
      <div className="border-t border-zinc-800/80 px-4 py-2.5 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-500">
        <span>{filteredEvents.length} events logged</span>
        {events.length > 0 && (
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
