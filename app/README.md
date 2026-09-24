# `app/` — Application Shell & Home Chat Dashboard

## 1. Directory Role & Boundary
The `app/` directory serves as the root of the Next.js 16 (App Router) frontend for Jarvis AI Assistant. It orchestrates the primary visual layout, global styling, system health monitoring, and the main interactive conversational dashboard.

---

## 2. File Inventory
| File | Role | Key Exports / Responsibilities |
| :--- | :--- | :--- |
| [`page.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/page.js) | Main Dashboard | Two-phase conversational interface, interactive workspace scope picker, active task chain integration, and desktop CLI launcher. |
| [`layout.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/layout.js) | Root Layout | HTML shell, font configurations, and global metadata for Jarvis Assistant. |
| [`globals.css`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/globals.css) | Global Styles | Tailwind CSS imports, custom scrollbar rules, and dark glassmorphic styling tokens. |
| [`favicon.ico`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/favicon.ico) | App Icon | Browser tab branding asset. |

---

## 3. Subdirectory Architecture
* [`components/`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/README.md): Modular UI blocks (TaskChainTracker, Chat, VoiceInput, PowerControls, ActivityFeed).
* [`lib/`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/lib/README.md): Network layer, `apiFetch` wrapper, and base URL resolution.
* [`workers/`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/workers/README.md): Autonomous worker launcher (`ForkForm`) and active session dashboard.
* [`worker/[id]/`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/worker/%5Bid%5D/README.md): Deep worker execution cockpit (SSE terminal, trace, test verification, handover & graphify panel).

---

## 4. State Management & Data Flow in `page.js`
1. **Visual Chat History (`messages`)**:
   * Initialized from `sessionStorage` (`jarvis_chat_messages`) after mount to prevent React hydration mismatch.
   * Visual reset (`newChat`) only clears visual UI state; the backend brain memory persists in SQLite and `JARVIS_MEMORY.md`.
2. **Dynamic Filesystem Scope (`fsScope`)**:
   * Active workspace directory boundary (e.g. `D:/workspace`, `D:/AI-Automation`).
   * Stored in `localStorage` under `jarvis_workspace_scope`.
   * Automatically passed in `POST /agent/run` and `POST /workers/open-terminal`.
3. **Two-Phase Agent Cycle**:
   * **Phase 1 (Analysis & Plan)**: `callAgent({ prompt, fs_scope })` returns proposed plan steps.
   * **Phase 2 (Confirmation)**: `callAgent({ prompt, confirm: true, plan_id, fs_scope })` executes the plan and triggers reactive pipelines.
4. **Active Plan Extraction**:
   * Scans messages in reverse for the latest bot message with mode `"plan"`.
   * Passed to `<TaskChainTracker />` for live progress tracking.

---

## 5. External API Contracts
* **`GET /health`**: Polled every 10 seconds to update the backend connection indicator.
* **`POST /agent/run`**: Primary agent execution endpoint.
  ```json
  {
    "prompt": "build landing page in D:/projects/site",
    "confirm": false,
    "plan_id": null,
    "session_id": "default",
    "fs_scope": "D:/projects/site"
  }
  ```
* **`POST /workers/open-terminal`**: Launches external CLI in the active `fsScope`.

---

## 6. Critical Invariants & Gotchas
* **Hydration Protection**: Never read `localStorage` or `sessionStorage` in the root component body. Always access storage inside a `useEffect` after setting `mounted = true`.
* **Dynamic Scoping**: Never hardcode `"D:/workspace"` in agent calls or terminal launchers. Always reference the dynamic `fsScope` state.
* **Plan Isolation**: `planExecution` must match only the active `plan_id` to prevent cross-talk when multiple plans exist in visual history.
