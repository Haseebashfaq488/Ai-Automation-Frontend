# `app/lib/` — Networking & Shared Utilities

## 1. Directory Role & Boundary
The `app/lib/` directory provides core utilities, client-side networking abstractions, and shared helper functions used throughout the application.

---

## 2. File Inventory
| File | Exports | Role |
| :--- | :--- | :--- |
| [`api.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/lib/api.js) | `API_URL`, `getHeaders()`, `apiFetch()` | Central HTTP communication wrapper. Applies base URLs, JSON content types, and tunnel bypass headers. |

---

## 3. Communication Contract
All client-side components communicating with the FastAPI backend must use `apiFetch`:

```javascript
import { apiFetch, API_URL } from "../lib/api";

// Example GET
const res = await apiFetch("/health");
const data = await res.json();

// Example POST
const res = await apiFetch("/agent/run", {
  method: "POST",
  body: JSON.stringify({ prompt: "..." }),
});
```

---

## 4. Critical Invariants & Gotchas
* **Ngrok Interstitial Bypass**: Free-tier ngrok tunnels inject an HTML interstitial warning that crashes `res.json()`. `getHeaders()` automatically includes `"ngrok-skip-browser-warning": "true"`. **Never** use raw `fetch()` directly without these headers.
* **Base URL Resolution**: Defaults to `process.env.NEXT_PUBLIC_API_URL` with a tunnel fallback. When running locally with a local backend, set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`.
* **SSE Streams**: SSE endpoints (`EventSource`) cannot use `apiFetch` (browser limitation). Construct SSE URLs using `API_URL`:
  ```javascript
  const source = new EventSource(`${API_URL}/workers/${sessionId}/stream`);
  ```
