"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";

const WAKE_URL =
  process.env.NEXT_PUBLIC_WAKE_URL ||
  "https://uncurrent-unspuriously-samual.ngrok-free.dev/wake?token=mysecret123";

export default function PowerControls() {
  const [wakeStatus, setWakeStatus] = useState("idle"); // "idle" | "sending" | "success" | "error"
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [shutdownScheduled, setShutdownScheduled] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [actionBusy, setActionBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const countdownIntervalRef = useRef(null);

  // ── 1. Boot Up (Wake PC via Webhook) ──────────────────────────────────
  async function handleBootUp() {
    if (wakeStatus === "sending") return;
    setWakeStatus("sending");
    setStatusMessage("Sending wake signal...");

    try {
      // Build URL with ngrok skip warning query parameter
      const url = new URL(WAKE_URL);
      url.searchParams.set("ngrok-skip-browser-warning", "true");

      try {
        // Standard GET request with ngrok skip header
        await fetch(url.toString(), {
          method: "GET",
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        });
      } catch (corsErr) {
        // Fallback to no-cors mode if the target webhook lacks CORS headers
        await fetch(url.toString(), {
          method: "GET",
          mode: "no-cors",
        });
      }

      setWakeStatus("success");
      setStatusMessage("Wake packet sent!");
      setTimeout(() => {
        setWakeStatus("idle");
        setStatusMessage("");
      }, 4000);
    } catch (err) {
      console.error("Wake signal failed:", err);
      setWakeStatus("error");
      setStatusMessage("Failed to send wake signal");
      setTimeout(() => {
        setWakeStatus("idle");
        setStatusMessage("");
      }, 4000);
    }
  }

  // ── 2. Shut Down (System Shutdown via Backend) ────────────────────────
  async function handleShutdownConfirm(delaySeconds = 10, force = false) {
    setActionBusy(true);
    try {
      const res = await apiFetch("/system/shutdown", {
        method: "POST",
        body: JSON.stringify({
          delay_seconds: delaySeconds,
          force: force,
          message: "Remote shutdown initiated from Jarvis Control Plane",
        }),
      });

      if (res.ok) {
        if (delaySeconds === 0) {
          setShowShutdownModal(false);
          alert("System shutdown command sent. The host PC is powering off.");
          return;
        }

        setShutdownScheduled(true);
        setShowShutdownModal(false);
        setCountdown(delaySeconds);

        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownIntervalRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Shutdown failed: ${data.detail || res.statusText}`);
      }
    } catch (err) {
      alert(`Error scheduling shutdown: ${err.message}`);
    } finally {
      setActionBusy(false);
    }
  }

  // ── 3. Cancel / Abort Shutdown ────────────────────────────────────────
  async function handleCancelShutdown() {
    setActionBusy(true);
    try {
      const res = await apiFetch("/system/cancel-shutdown", {
        method: "POST",
      });
      if (res.ok) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setShutdownScheduled(false);
        setCountdown(10);
      }
    } catch (err) {
      console.error("Failed to cancel shutdown:", err);
    } finally {
      setActionBusy(false);
    }
  }

  // ── 4. Lock Workstation ───────────────────────────────────────────────
  async function handleLock() {
    try {
      await apiFetch("/system/lock", { method: "POST" });
      setShowShutdownModal(false);
    } catch (err) {
      console.error("Lock workstation failed:", err);
    }
  }

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* ── Boot Up Button ── */}
      <button
        onClick={handleBootUp}
        disabled={wakeStatus === "sending"}
        title="Send Wake-on-LAN trigger packet via webhook URL"
        className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold shadow-sm transition active:scale-95 ${
          wakeStatus === "sending"
            ? "border-emerald-600 bg-emerald-950/80 text-emerald-300 animate-pulse"
            : wakeStatus === "success"
            ? "border-emerald-500 bg-emerald-900/70 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
            : wakeStatus === "error"
            ? "border-red-600 bg-red-950/70 text-red-300"
            : "border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:border-emerald-500 hover:bg-emerald-900/50 hover:text-emerald-100 hover:shadow-[0_0_10px_rgba(16,185,129,0.3)]"
        }`}
      >
        <span className="text-sm">⚡</span>
        <span className="hidden sm:inline">
          {wakeStatus === "sending"
            ? "Waking PC..."
            : wakeStatus === "success"
            ? "Wake Sent!"
            : wakeStatus === "error"
            ? "Retry Wake"
            : "Boot Up"}
        </span>
        <span className="sm:hidden">
          {wakeStatus === "sending" ? "..." : wakeStatus === "success" ? "Sent" : "Boot Up"}
        </span>
      </button>

      {/* ── Shut Down Button or Active Countdown ── */}
      {shutdownScheduled ? (
        <div className="flex items-center gap-1.5 rounded-xl border border-red-500/80 bg-red-950/80 px-2.5 py-1 text-xs font-semibold text-red-200 animate-pulse shadow-md shadow-red-950/50">
          <span className="text-sm">⏱️</span>
          <span>Shutting down in {countdown}s</span>
          <button
            onClick={handleCancelShutdown}
            disabled={actionBusy}
            className="ml-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowShutdownModal(true)}
          title="Shut down host PC remotely"
          className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border border-rose-800/60 bg-rose-950/30 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold text-rose-300 shadow-sm transition hover:border-rose-600 hover:bg-rose-900/40 hover:text-rose-100 hover:shadow-[0_0_10px_rgba(244,63,94,0.25)] active:scale-95"
        >
          <span className="text-sm">🛑</span>
          <span className="hidden sm:inline">Shut Down</span>
          <span className="sm:hidden">Shutdown</span>
        </button>
      )}

      {/* ── Shutdown Confirmation Modal ── */}
      {showShutdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/95 p-5 shadow-2xl shadow-black/80 text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-950/80 text-rose-400 border border-rose-800/60">
                  🛑
                </span>
                <h3 className="text-base font-semibold text-white">Power Management</h3>
              </div>
              <button
                onClick={() => setShowShutdownModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-sm text-zinc-300 leading-relaxed">
                Choose an action to execute on the host machine:
              </p>

              {/* Graceful 10s Countdown Shutdown */}
              <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-rose-200">Safe Shutdown</span>
                  <span className="text-[11px] font-medium text-rose-400">10s countdown</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Gracefully closes all applications and powers off the PC. Includes a 10-second cancel window.
                </p>
                <button
                  onClick={() => handleShutdownConfirm(10, false)}
                  disabled={actionBusy}
                  className="w-full rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-rose-950/50 hover:bg-rose-500 transition disabled:opacity-50"
                >
                  {actionBusy ? "Initiating..." : "🛑 Safe Shutdown (10s)"}
                </button>
              </div>

              {/* Immediate Shutdown */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-200">Immediate Force Shutdown</span>
                  <span className="text-[11px] font-medium text-zinc-400">Instant</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Immediately powers off the computer without waiting.
                </p>
                <button
                  onClick={() => handleShutdownConfirm(0, true)}
                  disabled={actionBusy}
                  className="w-full rounded-xl border border-rose-800/80 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 transition disabled:opacity-50"
                >
                  ⚡ Force Shut Down Now
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleLock}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition"
                >
                  🔒 Lock Workstation
                </button>
                <button
                  onClick={() => setShowShutdownModal(false)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
