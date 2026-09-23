"use client";

// ── ToolOutputViewer ────────────────────────────────────────────────────
// Renders tool execution outputs in a human-friendly format instead of
// raw JSON blobs. Inspects the tool name and data shape to pick the
// right presenter.

import { useState } from "react";

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-md bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function fileIcon(name) {
  const ext = (name || "").split(".").pop()?.toLowerCase();
  const icons = {
    py: "🐍", js: "🟨", ts: "🔷", json: "📋", md: "📝", txt: "📄",
    css: "🎨", html: "🌐", sh: "⚙️", env: "🔒", zip: "📦", docx: "📃",
    pdf: "📕", jpg: "🖼️", png: "🖼️", mp4: "🎬",
  };
  return icons[ext] || "📄";
}

function isDir(name) {
  return !name.includes(".");
}

// ──────────────────────────────────────────────────────────────────────
// File / Directory List
// ──────────────────────────────────────────────────────────────────────
function FileListView({ data }) {
  const [expanded, setExpanded] = useState(false);
  const items = data?.items || data?.files || data?.entries || [];
  if (!items.length && !data?.path) return null;

  const shown = expanded ? items : items.slice(0, 8);
  const header = data?.path || "";

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">📁</span>
          <span className="text-xs font-semibold text-zinc-200 truncate max-w-[200px] sm:max-w-[280px]" title={header}>
            {header || "Directory Listing"}
          </span>
          {items.length > 0 && (
            <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
              {items.length} {items.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>
      </div>
      <ul className="space-y-1.5">
        {shown.map((item, i) => {
          const name = typeof item === "string" ? item : (item?.name || item?.path || "");
          const dir = typeof item === "object" ? item?.is_dir || isDir(name) : isDir(name);
          const size = item?.size || item?.size_bytes;
          return (
            <li
              key={i}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 rounded-lg border border-zinc-800/40 bg-zinc-900/60 px-2.5 py-1.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-sm">{dir ? "📂" : fileIcon(name)}</span>
                <span className="truncate font-mono text-[11px] text-zinc-300" title={name}>
                  {name}
                </span>
              </div>
              <div className="flex shrink-0 items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                {size && (
                  <span className="text-[10px] text-zinc-500">
                    {typeof size === "number" ? `${(size / 1024).toFixed(1)} KB` : size}
                  </span>
                )}
                <CopyButton text={name} label="Copy path" />
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[11px] font-medium text-purple-400 hover:text-purple-300 transition"
        >
          {expanded ? "Show less ▲" : `Show ${items.length - 8} more ▼`}
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// File Content Viewer
// ──────────────────────────────────────────────────────────────────────
function FileContentView({ data }) {
  const content = data?.content ?? data?.text ?? "";
  const path = data?.path || "";
  const fileName = path.split(/[\\/]/).pop() || "file";
  const lines = content.split("\n");

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 bg-zinc-900/60 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span>{fileIcon(fileName)}</span>
          <span className="font-mono text-xs text-zinc-300 truncate">{fileName}</span>
          <span className="text-[10px] text-zinc-500 shrink-0">{lines.length} lines</span>
        </div>
        <CopyButton text={content} label="Copy content" />
      </div>
      <pre className="max-h-64 overflow-y-auto overflow-x-auto p-3 text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </pre>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Email Inbox
// ──────────────────────────────────────────────────────────────────────
function EmailListView({ data }) {
  const emails = data?.emails || data?.messages || (Array.isArray(data) ? data : []);
  if (!emails.length) return null;
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-base">✉️</span>
        <span className="text-xs font-semibold text-zinc-200">{emails.length} Email{emails.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-2">
        {emails.map((email, i) => {
          const from = email?.from || email?.sender || "Unknown sender";
          const subject = email?.subject || "(no subject)";
          const snippet = email?.snippet || email?.body || email?.preview || "";
          const date = email?.date || email?.timestamp || "";
          return (
            <div key={i} className="rounded-lg border border-zinc-800/40 bg-zinc-900/60 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-zinc-100 truncate">{subject}</p>
                  <p className="mt-0.5 truncate rounded-full bg-zinc-800/60 px-1.5 py-0.5 inline-block text-[10px] text-zinc-400">{from}</p>
                </div>
                {date && <span className="shrink-0 text-[10px] text-zinc-500">{date}</span>}
              </div>
              {snippet && (
                <p className="mt-1.5 text-[11px] text-zinc-400 line-clamp-2">{snippet}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// WhatsApp Chats / Messages
// ──────────────────────────────────────────────────────────────────────
function WhatsAppChatsView({ data }) {
  const chats = data?.chats || data?.conversations || (Array.isArray(data) ? data : []);
  if (!chats.length) return null;
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-base">💬</span>
        <span className="text-xs font-semibold text-zinc-200">{chats.length} Chat{chats.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-1.5">
        {chats.map((chat, i) => {
          const name = chat?.name || chat?.contact || chat?.id || `Chat ${i + 1}`;
          const last = chat?.last_message || chat?.snippet || "";
          const unread = chat?.unread || chat?.unread_count;
          const initials = name.slice(0, 2).toUpperCase();
          return (
            <div key={i} className="flex items-center gap-2.5 rounded-lg border border-zinc-800/40 bg-zinc-900/60 px-2.5 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-900/60 text-[11px] font-bold text-emerald-300">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-200 truncate">{name}</p>
                {last && <p className="text-[10px] text-zinc-500 truncate">{last}</p>}
              </div>
              {unread > 0 && (
                <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WhatsAppSentView({ data }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-800/40 bg-emerald-950/30 px-3 py-2 text-xs sm:text-sm text-emerald-300 break-words">
      <span>✓✓</span>
      <span>
        Message sent to <strong>{data?.to || "contact"}</strong>
        {data?.timestamp ? ` at ${data.timestamp}` : ""}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// File Action Result (create/write/delete/copy/move etc.)
// ──────────────────────────────────────────────────────────────────────
function FileActionView({ tool, data }) {
  const path = data?.path || data?.destination || data?.source || "";
  const fileName = path.split(/[\\/]/).pop() || path;
  const actionIcons = {
    create_file: ["✅", "Created", "emerald"],
    write_file: ["✏️", "Written to", "sky"],
    append_file: ["➕", "Appended to", "sky"],
    delete_file: ["🗑️", "Moved to trash", "amber"],
    delete_folder: ["🗑️", "Deleted folder", "amber"],
    copy: ["📋", "Copied", "purple"],
    move: ["↪️", "Moved", "purple"],
    rename: ["✏️", "Renamed", "purple"],
    create_folder: ["📁", "Created folder", "emerald"],
    archive: ["📦", "Archived to", "zinc"],
    extract: ["📂", "Extracted to", "zinc"],
    touch: ["👆", "Touched", "zinc"],
  };
  const [icon, action, color] = actionIcons[tool] || ["✓", "Done", "zinc"];
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-${color}-800/40 bg-${color}-950/30 px-3 py-2 text-xs sm:text-sm text-${color}-300 break-words`}>
      <span>{icon}</span>
      <span>
        {action}: <code className="font-mono text-[11px] sm:text-[12px]">{fileName || path}</code>
        {data?.size_bytes ? ` (${(data.size_bytes / 1024).toFixed(1)} KB)` : ""}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Generic Structured Fallback
// ──────────────────────────────────────────────────────────────────────
function GenericView({ data }) {
  const [showRaw, setShowRaw] = useState(false);

  if (typeof data === "string") {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 px-3 py-2.5 text-xs text-zinc-300 whitespace-pre-wrap break-words">
        {data}
      </div>
    );
  }

  const entries = Object.entries(data || {}).filter(
    ([k]) => !["raw", "events", "__type"].includes(k)
  );

  if (!entries.length) return null;

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/70 p-3">
      <div className="space-y-1.5">
        {entries.slice(0, 8).map(([k, v]) => (
          <div key={k} className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-2 text-xs">
            <span className="w-full sm:w-28 shrink-0 font-semibold text-zinc-500">{k}</span>
            <span className="text-zinc-300 truncate max-w-full sm:max-w-xs">
              {typeof v === "object" ? JSON.stringify(v).slice(0, 80) : String(v ?? "")}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={() => setShowRaw(!showRaw)}
        className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition"
      >
        {showRaw ? "Hide raw ▲" : "Inspect raw JSON ▼"}
      </button>
      {showRaw && (
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-[10px] text-zinc-400">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Google Drive Files View
// ──────────────────────────────────────────────────────────────────────
function DriveFilesView({ data, title = "Google Drive Files" }) {
  const [expanded, setExpanded] = useState(false);
  const files = data?.files || (Array.isArray(data) ? data : []);
  if (!files.length && !data?.file_id) return null;

  const shown = expanded ? files : files.slice(0, 8);

  return (
    <div className="rounded-xl border border-sky-800/40 bg-zinc-950/80 p-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">☁️</span>
          <span className="text-xs font-semibold text-sky-200 truncate">
            {data?.query ? `Drive Search: "${data.query}"` : title}
          </span>
          {files.length > 0 && (
            <span className="shrink-0 rounded-full bg-sky-950/80 border border-sky-800/40 px-2 py-0.5 text-[10px] text-sky-300 font-mono">
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
          )}
        </div>
      </div>
      <ul className="space-y-1.5">
        {shown.map((file, i) => {
          const name = file?.name || "Untitled";
          const isFolder = file?.is_folder || file?.mimeType === "application/vnd.google-apps.folder";
          const size = file?.size_formatted || (file?.size ? `${(file.size / 1024).toFixed(1)} KB` : (isFolder ? "Folder" : ""));
          const link = file?.webViewLink;

          return (
            <li
              key={file?.id || i}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/70 px-2.5 py-2 hover:border-sky-800/50 transition"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-sm">{isFolder ? "📁" : fileIcon(name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] text-zinc-200 font-medium" title={name}>
                    {name}
                  </p>
                  {file?.id && (
                    <p className="font-mono text-[9px] text-zinc-500 truncate">
                      ID: {file.id}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                {size && (
                  <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
                    {size}
                  </span>
                )}
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-sky-950/60 border border-sky-800/40 px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-900/60 transition"
                  >
                    Open ↗
                  </a>
                )}
                {file?.id && <CopyButton text={file.id} label="Copy ID" />}
              </div>
            </li>
          );
        })}
      </ul>
      {files.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[11px] font-medium text-sky-400 hover:text-sky-300 transition"
        >
          {expanded ? "Show less ▲" : `Show ${files.length - 8} more ▼`}
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main dispatcher
// ──────────────────────────────────────────────────────────────────────
const FILE_LIST_TOOLS = new Set([
  "list_directory", "list_files", "search_files", "organize_downloads",
]);
const FILE_CONTENT_TOOLS = new Set(["read_file"]);
const FILE_ACTION_TOOLS = new Set([
  "create_file", "write_file", "append_file", "delete_file",
  "delete_folder", "copy", "move", "rename", "create_folder",
  "archive", "extract", "touch", "bulk_rename",
]);
const DRIVE_LIST_TOOLS = new Set(["list_drive_files", "search_drive"]);
const EMAIL_TOOLS = new Set(["list_recent_emails", "send_email"]);
const WA_CHATS_TOOLS = new Set(["list_chats", "whatsapp_status"]);
const WA_MSG_TOOLS = new Set(["send_message", "send_file", "get_messages"]);

export default function ToolOutputViewer({ tool, data }) {
  if (!data) return null;

  if (DRIVE_LIST_TOOLS.has(tool)) {
    if (data?.files || Array.isArray(data)) {
      return <DriveFilesView data={data} />;
    }
  }

  if (tool === "upload_drive_file") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-800/40 bg-sky-950/30 px-3 py-2 text-xs sm:text-sm text-sky-300 break-words">
        <div className="flex items-center gap-2 min-w-0">
          <span>☁️</span>
          <span>
            Uploaded <strong className="font-mono text-zinc-100">{data?.name || "file"}</strong> to Google Drive
            {data?.size_formatted ? ` (${data.size_formatted})` : ""}
          </span>
        </div>
        {data?.webViewLink && (
          <a
            href={data.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-sky-900/60 border border-sky-700/50 px-2 py-0.5 text-[10px] font-medium text-sky-200 hover:bg-sky-800/60 transition"
          >
            Open in Drive ↗
          </a>
        )}
      </div>
    );
  }

  if (tool === "read_drive_file") {
    if (data?.content !== undefined) {
      return <FileContentView data={{ ...data, path: data?.name || "Drive File" }} />;
    }
    if (data?.saved_to) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-800/40 bg-emerald-950/30 px-3 py-2 text-xs sm:text-sm text-emerald-300">
          <span>✅</span>
          <span>Downloaded Google Drive file to <code className="font-mono text-[11px]">{data.saved_to}</code></span>
        </div>
      );
    }
  }

  if (FILE_LIST_TOOLS.has(tool)) {
    const listData =
      Array.isArray(data?.items) || Array.isArray(data?.files) || Array.isArray(data?.entries)
        ? data
        : Array.isArray(data)
        ? { items: data }
        : null;
    if (listData) return <FileListView data={listData} />;
  }

  if (FILE_CONTENT_TOOLS.has(tool)) {
    if (data?.content !== undefined || data?.text !== undefined) {
      return <FileContentView data={data} />;
    }
  }

  if (EMAIL_TOOLS.has(tool)) {
    if (tool === "send_email") {
      return (
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-800/40 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          <span>✅</span>
          <span>Email sent to <strong>{data?.to || "recipient"}</strong></span>
        </div>
      );
    }
    const emails = data?.emails || data?.messages || (Array.isArray(data) ? data : null);
    if (emails) return <EmailListView data={{ emails }} />;
  }

  if (WA_CHATS_TOOLS.has(tool)) {
    const chats = data?.chats || data?.conversations || (Array.isArray(data) ? data : null);
    if (chats) return <WhatsAppChatsView data={{ chats }} />;
  }

  if (WA_MSG_TOOLS.has(tool)) {
    if (tool === "send_message" || tool === "send_file") {
      return <WhatsAppSentView data={data} />;
    }
    const msgs = data?.messages || (Array.isArray(data) ? data : null);
    if (msgs) return <WhatsAppChatsView data={{ chats: msgs }} />;
  }

  // Direct Task Execution / Intervention special cases (already rendered by StepBubble)
  if (tool === "task_execution" || tool === "apply_intervention" || tool === "opencode_milestone") {
    return null;
  }

  // Worker URL special case
  if (data?.worker_url) {
    return null; // Chat.js handles this already
  }

  return <GenericView data={data} />;
}

