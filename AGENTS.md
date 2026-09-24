<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Jarvis AI Automation Frontend

## 1. Project Overview & Role
This repository (`Haseebashfaq488/Ai-Automation-Frontend`) is the standalone Next.js 16 web interface for the Jarvis AI Assistant ecosystem. It communicates with the FastAPI backend engine (`:8000`) and serves as the command center for chat, task chains, autonomous worker supervision, and session handovers.

---

## 2. Navigating the Codebase: The Living Documentation Rule

> [!IMPORTANT]
> **MANDATORY FIRST STEP BEFORE ANY CODE CHANGE:**
> Before inspecting, modifying, or creating files in any folder, you **MUST** first read that directory's local `README.md`. 
> Do **NOT** crawl through 1,800-line files blindly or guess API contracts. The local `README.md` contains the authoritative architectural contract, props table, and known gotchas.

### Living Documentation Map:
| Directory | Local Living Doc | What It Explains |
| :--- | :--- | :--- |
| **`app/`** | [`app/README.md`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/README.md) | Root App Router shell, Home chat dashboard, dynamic `fsScope` persistence, two-phase planning loop. |
| **`app/components/`** | [`app/components/README.md`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/README.md) | Shared UI widgets (`TaskChainTracker`, `Chat`, `VoiceInput`, `ActivityFeed`), polling lifecycle rules. |
| **`app/lib/`** | [`app/lib/README.md`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/lib/README.md) | Networking layer, `apiFetch` wrapper, ngrok interstitial bypass, base URL resolution. |
| **`app/workers/`** | [`app/workers/README.md`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/workers/README.md) | Workers overview dashboard, `ForkForm` parameters, status badge styling. |
| **`app/worker/[id]/`** | [`app/worker/[id]/README.md`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/worker/%5Bid%5D/README.md) | Worker Cockpit, 7-tab architecture (Live terminal, Plan review, Trace, Tests, Artifacts, Review, Handover). |

---

## 3. How to Maintain & Update Folder Documentation

Whenever you modify or extend code in this repository, you must keep the documentation synchronized:

1. **When Modifying Existing Files**:
   * If you add new props, change state variables, or consume new API endpoints, update the corresponding table in that folder's `README.md`.
2. **When Resolving Bugs or Discovering Edge Cases**:
   * Add the discovery under the **Critical Invariants & Gotchas** section of that folder's `README.md` so future workers or session resumes do not regress the fix (e.g. interval cleanup, dependency array pitfalls).
3. **When Creating a New Folder**:
   * Create a new `README.md` in that directory following the **Standard Anatomy**:
     1. *Directory Role & Boundary* (1–2 sentences)
     2. *File Inventory & Roles* (Markdown table of files & responsibilities)
     3. *External Contracts & APIs* (Endpoints called, SSE streams, storage keys)
     4. *Critical Invariants & Gotchas* (Rules that must not be broken)
     5. *Extension Guide* (How to hook into this module)

---

## 4. Frontend Engineering Invariants

* **API Calls**: Always use `apiFetch` from [`app/lib/api`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/lib/api.js). Never call `fetch()` directly without ngrok headers.
* **Workspace Scoping**: Respect the dynamic `fsScope` stored in `localStorage["jarvis_workspace_scope"]`. Never hardcode `"D:/workspace"`.
* **SSE Stream Lifecycle**: Always close `EventSource` connections in `useEffect` cleanup handlers or when receiving terminal events (`WORK_COMPLETED`, `result`).
* **Polling Safety**: When polling endpoints, decouple mutable state from the `useEffect` dependency array and use functional state updaters (`setState(prev => ...)`) to prevent premature interval teardowns.
* **Design System**: Maintain the dark glassmorphic aesthetic (`bg-zinc-950`, `bg-zinc-900/80`, `border-zinc-800`, purple/sky accents).
* **Build Validation**: Always verify changes by running `npm run build` (Turbopack) before pushing.
