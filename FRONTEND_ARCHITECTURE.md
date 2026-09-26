# Jarvis AI Automation — Frontend Architecture & Agent Guide

> **Standalone Frontend Repository**: `https://github.com/Haseebashfaq488/Ai-Automation-Frontend`  
> **Backend / Control Plane Repository**: `https://github.com/Haseebashfaq488/AI-Automation`

---

## 1. Overview & Separation of Concerns

This directory / repository is the **standalone Next.js frontend** for the Jarvis AI Automation Control Plane. It is completely decoupled from the Python backend:

* **No direct backend code imports**: No Python modules, SQLite drivers, or direct filesystem access.
* **Pure API client**: All interactions happen via HTTP REST endpoints and Server-Sent Events (SSE) streaming.
* **Centralized Configuration**: Controlled via `process.env.NEXT_PUBLIC_API_URL` and `process.env.NEXT_PUBLIC_WAKE_URL`.

---

## 2. Key Pages & Routes

| Route | File | Description |
|---|---|---|
| `/` | `app/page.js` | **Jarvis Assistant Hub**: Conversational AI chat, Antigravity brain orchestrator, quick actions, and real-time activity feed drawer. |
| `/avatar-studio` | `app/avatar-studio/page.js` | **3D Avatar Testing Studio**: Full testing sandbox for VRM 3D avatar, motion capture library (44+ animations including custom Blender-generated 8s idle loop), facial blendshapes, camera presets, and real-time Edge Neural TTS speech choreography. |
| `/workers` | `app/workers/page.js` | **Autonomous Worker Fleet Dashboard**: Create (fork) coding/automation workers, live status monitoring (running/completed/cancelled), search & filtering, and CLI launcher. |
| `/worker/[id]` | `app/worker/[id]/page.js` | **Deep Worker Live Console**: Real-time terminal SSE stream, execution trace steps, tool inspection, user intervention, cancellation, and artifact browser. |

---

## 3. Core Components

* **`PowerControls.js`** (`app/components/PowerControls.js`):
  * **⚡ Boot Up**: Triggers Wake-on-LAN webhook (`NEXT_PUBLIC_WAKE_URL`) with automatic `ngrok-skip-browser-warning` bypass.
  * **🛑 Shut Down**: Modal providing Safe Shutdown (10s cancellable countdown), Instant Force Shutdown, and Workstation Lock (`/system/shutdown`, `/system/cancel-shutdown`, `/system/lock`).
* **`TaskChainTracker.js`** (`app/components/TaskChainTracker.js`):
  * Multi-step task plan visualizer, dependency chaining, and automatic worker orchestration.
* **`ActivityFeed.js`** (`app/components/ActivityFeed.js`):
  * Global real-time SSE listener (`/events/stream`) tracking events across the entire Jarvis backend.
* **`Chat.js`** (`app/components/Chat.js`):
  * Interactive chat message bubbles, plan confirmation cards, tool execution summaries.
* **`VoiceInput.js`** (`app/components/VoiceInput.js`):
  * Real-time browser speech recognition with silence detection and voice command activation.
* **`ToolOutputViewer.js`** (`app/components/ToolOutputViewer.js`):
  * Formatted viewer for tool payloads, files, and diff outputs.
* **`api.js`** (`app/lib/api.js`):
  * Unified `apiFetch` wrapper with automatic ngrok bypass headers (`ngrok-skip-browser-warning: true`).

---

## 4. Environment Variables

Create `.env.local` for local development or configure in Vercel Settings:

```env
# Backend FastAPI Control Plane API Base URL (or ngrok tunnel)
NEXT_PUBLIC_API_URL="https://upstairs-earring-craftwork.ngrok-free.dev"

# Boot Up / Wake-on-LAN Webhook URL
NEXT_PUBLIC_WAKE_URL="https://uncurrent-unspuriously-samual.ngrok-free.dev/wake?token=mysecret123"
```

---

## 5. Deployment on Vercel

1. **Repository**: Point Vercel to `https://github.com/Haseebashfaq488/Ai-Automation-Frontend`.
2. **Framework Preset**: Next.js.
3. **Build Command**: `npm run build` (or Next.js default).
4. **Environment Variables**: Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WAKE_URL`.
