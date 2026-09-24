# `app/components/` — Shared Component Library

## 1. Directory Role & Boundary
The `app/components/` directory houses reusable UI components across the Jarvis interface. Components here must remain modular, receive configuration via props, and avoid hardcoding global routing or business logic.

---

## 2. Component Inventory
| Component | Primary File | Responsibilities & Props |
| :--- | :--- | :--- |
| **TaskChainTracker** | [`TaskChainTracker.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/TaskChainTracker.js) | Left-rail vertical stepper showing real-time multi-step task execution (e.g. Fork Worker ➔ Send Email ➔ Upload Drive).<br>**Props**: `activePlan`, `planExecution`, `isOpenMobile`, `onCloseMobile`. |
| **Chat** | [`Chat.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/Chat.js) | Renders conversational bubbles.<br>Exports `UserBubble` and `BotMessage` (handles plan proposal cards, step lists, and the "Confirm & Execute Plan" CTA).<br>**Props**: `msg`, `onConfirm`. |
| **VoiceInput** | [`VoiceInput.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/VoiceInput.js) | Voice dictation via Web Speech API (`webkitSpeechRecognition`) with Alt+V shortcut, sound-wave animations, and auto-send options.<br>**Props**: `disabled`, `onTranscriptInsert`, `onAutoSend`. |
| **ActivityFeed** | [`ActivityFeed.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/ActivityFeed.js) | Slide-out right drawer subscribing to `/events/stream` (SSE) to render audit trails and real-time event logs across all workers.<br>**Props**: `isOpen`, `onClose`. |
| **PowerControls** | [`PowerControls.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/PowerControls.js) | System hardware controls (sleep, lock, hibernate) and battery / backend connectivity diagnostics. |
| **ToolOutputViewer** | [`ToolOutputViewer.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/ToolOutputViewer.js) | Syntax-highlighted and collapsible modal for raw tool execution outputs, JSON payloads, and diffs.<br>**Props**: `output`, `isOpen`, `onClose`. |

---

## 3. Critical Invariants & Gotchas

### TaskChainTracker Polling Lifecycle
* **Interval Teardown Hazard**: Do **NOT** put mutable state (`pipelineSteps` or `pollTick`) in the polling `useEffect` dependency array. The dependency array must remain strictly `[activeSessionId]` or empty with functional state updates (`setPipelineSteps(prev => ...)`). Including mutable state causes React to tear down and re-run cleanup between consecutive async calls, cancelling in-flight polls.
* **Category-Aware Matching (`matchTools`)**: Chained hooks must match tools within their module family (e.g., matching `send_email` or `list_recent_emails` to `gmail`, and `upload_drive_file` to `drive`).

### EventSource (SSE) Cleanup
* Any component opening an `EventSource` (`ActivityFeed`, etc.) must close the stream in its `useEffect` cleanup return function:
  ```javascript
  return () => {
    eventSource.close();
  };
  ```

### Design Consistency
* Use standard Tailwind tokens: background `bg-zinc-950` / `bg-zinc-900/80`, borders `border-zinc-800`, text `text-zinc-100` / `text-zinc-400`, purple/sky accent highlights.
