# `app/workers/` — Worker Management & Launch Dashboard

## 1. Directory Role & Boundary
The `app/workers/` directory implements the global worker operations dashboard (`/workers`). It provides high-level observability over all background worker sessions (running, awaiting approval, completed, cancelled) and hosts the `ForkForm` modal to launch new autonomous agents.

---

## 2. File Inventory
| File | Role | Responsibilities |
| :--- | :--- | :--- |
| [`page.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/workers/page.js) | Workers Hub Page | Worker session polling (`/workers/list`), filterable worker grid, statistics bar, and `ForkForm` creation card. |

---

## 3. Core Features & Sub-components in `page.js`

### A. ForkForm (Worker Provisioning)
Allows the user to spin up an autonomous worker with strict boundaries:
* **Objective**: Task description and deliverables.
* **Worker Engine**: 
  * `antigravity_worker` (Antigravity CLI with Gemini 3.8 Flash, multi-job planning, execution, and verification).
  * `opencode_worker` (OpenCode runtime fallback).
* **Filesystem Scope (`fs_scope`)**:
  * Bound to `localStorage["jarvis_workspace_scope"]`.
  * Quick presets: `D:/workspace`, `D:/AI-Automation`.
  * **Continuity Note**: Workers launched in an existing project scope automatically inherit prior `SESSION_HANDOVER.md` briefs and AST `graphify` knowledge graphs for non-destructive incremental progress.
* **Model Selection**: Presets (`gemini-3.8-flash-medium`, `gemini-2.5-pro`) or custom model identifier.

### B. Worker Session Card Grid
* Polls `GET /workers/list` every 3 seconds.
* Displays status badges:
  * `running` (sky glow)
  * `awaiting_plan_approval` (amber ping — indicates worker is paused in Job 1 awaiting human sign-off)
  * `completed` (emerald)
  * `cancelled` (amber)
* Quick links to navigate directly into [`/worker/[id]`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/worker/%5Bid%5D/README.md).

---

## 4. External API Contracts
* **`GET /workers/list`**: Fetches array of all active and historic worker sessions with their states and progress percentages.
* **`POST /workers/fork`**:
  ```json
  {
    "objective": "Build REST API endpoints",
    "worker_type": "antigravity_worker",
    "model": "gemini-3.8-flash-medium",
    "fs_scope": "D:/workspace",
    "max_steps": 20
  }
  ```
  Returns `{ "session_id": "...", "status": "running" }` and redirects to `/worker/{session_id}`.

---

## 5. Critical Invariants & Gotchas
* **Scope Synchronization**: Any changes to `fs_scope` in the `ForkForm` should sync back to `localStorage` (`jarvis_workspace_scope`) so that both the home chat and the worker dashboard remain aligned to the user's active project directory.
* **Interval Management**: The polling interval (`setInterval`) must always be cleared in the `useEffect` cleanup return to prevent background memory leaks upon navigation.
