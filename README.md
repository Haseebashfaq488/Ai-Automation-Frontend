# Jarvis AI Automation — Frontend

Next.js 16 frontend control plane for the **Jarvis AI Assistant & Autonomous Worker Fleet**.

🔗 **Connected Repository**: `https://github.com/Haseebashfaq488/Ai-Automation-Frontend`  
🔗 **Backend Engine Repository**: `https://github.com/Haseebashfaq488/AI-Automation`

---

## ✨ Features

- 🌌 **Jarvis Assistant Hub**: Multi-turn chat interface with Antigravity living memory, task resolution cards, and quick suggestion prompts.
- ⚡ **Remote Power Controls**: One-click **Boot Up** (Wake-on-LAN webhook caller) and **Shut Down** (safe countdown, force shutdown, workstation lock).
- 🤖 **Autonomous Worker Fleet Dashboard**: Fork coding and automation tasks, search & monitor active sessions in real time.
- 📟 **Real-time Live Worker Console**: Server-Sent Events (SSE) streaming console, step-by-step trace inspection, user intervention, and artifact downloads.
- 🎙️ **Voice Control**: Browser speech recognition with auto-silence detection and voice command streaming.
- 🎭 **3D VRM Avatar & Mocap Engine**: Interactive 3D avatar with 43 mocap animations, spring-bone hair/cloth physics, emotion blendshapes, and Edge Neural TTS speech-timed choreography.
- 🧪 **Avatar Testing Studio (`/avatar-studio`)**: Real-time playground to test all 43 mocap animations, viseme lip-sync, camera presets, and delimiter-driven speech scripts.
- 📡 **Real-time Event Stream**: Live global activity feed listening to the backend event bus.

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL="https://upstairs-earring-craftwork.ngrok-free.dev"
NEXT_PUBLIC_WAKE_URL="https://uncurrent-unspuriously-samual.ngrok-free.dev/wake?token=mysecret123"
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### 4. Build for Production

```bash
npm run build
npm start
```

---

## 📖 Architecture & Agent Guide

See [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md) for detailed documentation on pages, components, and backend API contracts.
