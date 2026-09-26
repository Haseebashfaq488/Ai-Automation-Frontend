"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  playTTS,
  stopTTS,
  isTTSPlaying,
  setTTSVoice,
  getTTSVoice,
  setTTSMuted,
  isTTSMuted,
  getLiveAudioVolume,
  AVAILABLE_VOICES,
} from "../lib/ttsPlayer";

const AvatarCanvas = dynamic(() => import("../components/avatar/AvatarCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full min-h-[480px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-sm text-zinc-500">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 animate-ping rounded-full bg-purple-500" />
        <span>Loading 3D VRM Model & Mocap Engine...</span>
      </div>
    </div>
  ),
});

const GESTURE_CATEGORIES = {
  greetings: {
    label: "👋 Greetings & Bows",
    items: [
      { id: "greeting", name: "Greeting Wave", icon: "👋" },
      { id: "waving", name: "Casual Wave", icon: "🙋" },
      { id: "wave", name: "Goodbye Wave", icon: "👋" },
      { id: "standing_greeting", name: "Poised Welcome", icon: "✨" },
      { id: "salute_greeting", name: "Salute", icon: "🫡" },
      { id: "bow", name: "Respectful Bow", icon: "🙇" },
      { id: "formal_bow", name: "Formal Bow", icon: "🎎" },
      { id: "thankful", name: "Thankful Heart", icon: "🙏" },
    ],
  },
  cute: {
    label: "💖 Cute & Affection",
    items: [
      { id: "shy", name: "Shy Twist", icon: "😳" },
      { id: "heart_hands", name: "Heart Hands", icon: "🫶" },
      { id: "peace_sign", name: "Double Peace", icon: "✌️" },
      { id: "cute_pose", name: "Cute Pose", icon: "🥰" },
      { id: "cat_pose", name: "Neko Cat Paws", icon: "🐾" },
      { id: "blowing_kiss", name: "Blowing Kiss", icon: "😘" },
      { id: "blush", name: "Blush Twirl", icon: "🌸" },
      { id: "cute_idle", name: "Cute Idle Sway", icon: "🎀" },
    ],
  },
  conversational: {
    label: "💬 Dialogue & Explaining",
    items: [
      { id: "talking", name: "Conversational Talking", icon: "🗣️" },
      { id: "presenting", name: "Presenting Guide", icon: "💁" },
      { id: "nodding", name: "Affirmative Nod", icon: "😌" },
      { id: "shake_no", name: "Head Shake No", icon: "🙅" },
      { id: "task_received", name: "Task Received", icon: "✅" },
      { id: "pointing_thinking", name: "Finger Pointing", icon: "☝️" },
      { id: "check_time", name: "Check Watch / Time", icon: "⌚" },
      { id: "shrugging", name: "Shrug / Dunno", icon: "🤷" },
      { id: "thinking", name: "Deep Thinking", icon: "🤔" },
    ],
  },
  energy: {
    label: "🎉 Happiness & Cheering",
    items: [
      { id: "joyful_jump", name: "Joyful Jump", icon: "🦘" },
      { id: "happy_gesture", name: "Happy Gesture", icon: "😄" },
      { id: "happy_idle", name: "Upbeat Bounce", icon: "🎈" },
      { id: "encouraging", name: "You Can Do It!", icon: "💪" },
      { id: "clapping", name: "Applause / Clap", icon: "👏" },
      { id: "cheering", name: "Mixamo Cheering", icon: "🥳" },
    ],
  },
  poses: {
    label: "🧘 Casual & Postures",
    items: [
      { id: "curious_leaning", name: "Curious Lean", icon: "🧐" },
      { id: "hands_on_hips", name: "Hands on Hips", icon: "💃" },
      { id: "neck_stretch", name: "Neck Stretch", icon: "🙆" },
      { id: "look_around", name: "Look Around", icon: "👀" },
      { id: "relax", name: "Chill Relax", icon: "☕" },
      { id: "relieved", name: "Relieved Sigh", icon: "😮‍💨" },
      { id: "sleepy", name: "Sleepy Yawn", icon: "🥱" },
      { id: "model_pose", name: "Fashion Model", icon: "📸" },
    ],
  },
  reactions: {
    label: "🎭 Drama & Reactions",
    items: [
      { id: "surprised", name: "Startled Surprise", icon: "😲" },
      { id: "sad", name: "Depressed Sad", icon: "😢" },
      { id: "angry", name: "Angry Stomp", icon: "😡" },
      { id: "dying", name: "Dramatic Faint", icon: "💀" },
    ],
  },
};

const EMOTIONS = [
  { id: "neutral", name: "Neutral Calm", icon: "😐" },
  { id: "happy", name: "Happy Smile", icon: "😊" },
  { id: "happy_wave", name: "Radiant Joy", icon: "🌟" },
  { id: "happy_heart", name: "Heartfelt Love", icon: "💖" },
  { id: "happy_clap", name: "Excited Cheerful", icon: "🎉" },
  { id: "relaxed", name: "Serene Relaxed", icon: "😌" },
  { id: "nodding", name: "Receptive Listening", icon: "👂" },
  { id: "surprised", name: "Wide Eyed Surprise", icon: "😮" },
  { id: "sad", name: "Gentle Pout", icon: "🥺" },
  { id: "angry", name: "Frustrated Pout", icon: "😤" },
];

const PRESET_SCRIPTS = [
  {
    title: "🌟 Welcoming Intro",
    text: "<<<gesture: greeting, expression: happy_wave>>> Hello there! <<<gesture: cute_pose, expression: happy>>> Welcome to the 3D Avatar Testing Studio! <<<gesture: presenting>>> Everything you see here is interactive.",
  },
  {
    title: "🎀 Cute & Affectionate",
    text: "<<<gesture: shy, expression: relaxed>>> Oh my, thank you for visiting! <<<gesture: heart_hands, expression: happy_heart>>> I am sending you all my positive energy! <<<gesture: blowing_kiss>>> Mwah!",
  },
  {
    title: "💼 Professional Assistant",
    text: "<<<gesture: salute_greeting, expression: happy>>> Jarvis system online and ready for instructions. <<<gesture: task_received, expression: relaxed>>> All autonomous workers are standing by to execute your tasks.",
  },
  {
    title: "🎉 Celebration",
    text: "<<<gesture: joyful_jump, expression: happy_clap>>> We did it! Incredible job! <<<gesture: clapping, expression: happy_clap>>> Let us celebrate this amazing milestone together!",
  },
  {
    title: "🙇 Respectful Bow",
    text: "<<<gesture: formal_bow, expression: relaxed>>> Thank you very much for your kind cooperation. <<<gesture: thankful, expression: happy_heart>>> It is an honor to assist you.",
  },
];

export default function AvatarStudioPage() {
  const [activeTab, setActiveTab] = useState("gestures"); // gestures | emotions | assistant | sandbox
  const [selectedCategory, setSelectedCategory] = useState("greetings");
  const [activeGesture, setActiveGesture] = useState("none");
  const [activeEmotion, setActiveEmotion] = useState("neutral");
  const [assistantMode, setAssistantMode] = useState("idle"); // idle | listening | speaking
  const [isLooping, setIsLooping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Sandbox State
  const [sandboxText, setSandboxText] = useState(PRESET_SCRIPTS[0].text);
  const [selectedVoice, setSelectedVoice] = useState("en-US-AvaNeural");
  const [isMuted, setIsMuted] = useState(false);

  // Volume Bar DOM Refs (direct DOM updates eliminate React re-renders)
  const volumeBarRef = useRef(null);
  const volumeTextRef = useRef(null);

  // Model & Scene Controller
  const [selectedModel, setSelectedModel] = useState("/avatar/Latest_Avatar.vrm");
  const avatarControllerRef = useRef(null);
  const sceneControllerRef = useRef(null);

  // Sync stored voice
  useEffect(() => {
    try {
      const stored = getTTSVoice();
      if (stored) setSelectedVoice(stored);
      setIsMuted(isTTSMuted());
    } catch {}
  }, []);

  // Monitor live audio amplitude directly via DOM
  useEffect(() => {
    let animId;
    function pollVolume() {
      const vol = getLiveAudioVolume();
      const pct = Math.round(vol * 100);
      if (volumeBarRef.current) {
        volumeBarRef.current.style.width = `${pct}%`;
      }
      if (volumeTextRef.current) {
        volumeTextRef.current.textContent = `${pct}%`;
      }
      animId = requestAnimationFrame(pollVolume);
    }
    animId = requestAnimationFrame(pollVolume);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleLoaded = useCallback(({ avatar, scene }) => {
    avatarControllerRef.current = avatar;
    sceneControllerRef.current = scene;
  }, []);

  // Camera framing presets
  function setCameraPreset(preset) {
    const scene = sceneControllerRef.current;
    if (!scene || !scene.camera) return;
    if (preset === "face") {
      scene.camera.position.set(0, 1.38, 0.75);
      scene.controls?.target.set(0, 1.35, 0);
    } else if (preset === "portrait") {
      scene.camera.position.set(0, 1.15, 1.4);
      scene.controls?.target.set(0, 1.05, 0);
    } else if (preset === "full") {
      scene.camera.position.set(0, 0.85, 2.4);
      scene.controls?.target.set(0, 0.8, 0);
    }
    scene.controls?.update();
  }

  // Play gesture immediately
  function triggerGesture(gestureId) {
    const avatar = avatarControllerRef.current;
    if (!avatar || !avatar.animations) return;
    setActiveGesture(gestureId);
    avatar.animations.play(gestureId, { loop: isLooping, fadeDuration: 0.35 });
  }

  // Stop motion
  function stopMotion() {
    const avatar = avatarControllerRef.current;
    if (!avatar) return;
    stopTTS();
    avatar.animations?.stop(0.4);
    setActiveGesture("none");
  }

  // Apply facial emotion
  function triggerEmotion(emotionId) {
    const avatar = avatarControllerRef.current;
    if (!avatar || !avatar.expressions) return;
    setActiveEmotion(emotionId);
    avatar.expressions.setEmotion(emotionId);
  }

  // Switch assistant mode
  function triggerAssistantMode(mode) {
    const avatar = avatarControllerRef.current;
    if (!avatar || !avatar.assistant) return;
    setAssistantMode(mode);
    avatar.assistant.setMode(mode);
  }

  // Test mouth viseme
  function testViseme(v) {
    const avatar = avatarControllerRef.current;
    if (!avatar?.vrm?.expressionManager) return;
    for (const vis of ["aa", "ee", "ih", "oh", "ou"]) {
      avatar.vrm.expressionManager.setValue(vis, vis === v ? 1.0 : 0);
    }
    setTimeout(() => {
      avatar.vrm.expressionManager.setValue(v, 0);
    }, 700);
  }

  // Run full speech choreography
  async function runChoreography(script) {
    const avatar = avatarControllerRef.current;
    const textToRun = script || sandboxText;
    if (!textToRun.trim()) return;

    setAssistantMode("speaking");
    stopTTS();

    playTTS(textToRun, {
      voice: selectedVoice,
      onPlay: ({ audio }) => {
        setAssistantMode("speaking");
        if (avatar) {
          avatar.assistant.setMode("speaking");
        }
      },
      onEnd: () => {
        setAssistantMode("idle");
        if (avatar) {
          avatar.assistant.setMode("idle");
        }
      },
      onError: () => {
        setAssistantMode("speaking");
        setTimeout(() => setAssistantMode("idle"), 4000);
      },
    });
  }

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-950 font-sans text-zinc-100 overflow-hidden">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
          >
            <span>←</span>
            <span>Back to Jarvis</span>
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <h1 className="text-sm font-semibold tracking-wide text-zinc-200 flex items-center gap-2">
            <span>🎭</span>
            <span>3D Avatar Testing Studio</span>
            <span className="rounded bg-purple-950 px-2 py-0.5 text-[10px] font-mono text-purple-300 border border-purple-800/60">
              Motion & Delimiter Playground
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Model Selector */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="text-[11px] font-mono text-zinc-500">Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] text-purple-300 outline-none"
            >
              <option value="/avatar/Latest_Avatar.vrm">Latest_Avatar.vrm (Active)</option>
              <option value="/avatar/model.vrm">model.vrm (Original)</option>
            </select>
          </div>

          {/* Mute Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              setTTSMuted(next);
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-mono transition border flex items-center gap-1 ${
              isMuted
                ? "border-zinc-700 bg-zinc-800 text-zinc-400"
                : "border-purple-800 bg-purple-950/80 text-purple-300"
            }`}
          >
            <span>{isMuted ? "🔇" : "🔊"}</span>
            <span className="text-[11px]">{isMuted ? "Muted" : "Audio On"}</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body: 2 Columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN: 3D Viewport & Scene Tools */}
        <div className="relative flex flex-1 flex-col border-r border-zinc-800/80 bg-zinc-950">
          {/* 3D Canvas */}
          <div className="relative h-full w-full flex-1">
            <AvatarCanvas
              avatarUrl={selectedModel}
              assistantState={assistantMode}
              currentMessage={sandboxText}
              onLoaded={handleLoaded}
              className="h-full w-full rounded-none border-0"
            />

            {/* Overlaid HUD status */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/80 px-3 py-1.5 text-xs backdrop-blur-md">
                <span className="text-zinc-500">Mode:</span>
                <span className="font-mono font-semibold text-purple-300 capitalize">{assistantMode}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-500">Gesture:</span>
                <span className="font-mono font-semibold text-emerald-400">{activeGesture}</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-500">Emotion:</span>
                <span className="font-mono font-semibold text-amber-300">{activeEmotion}</span>
              </div>

              {/* Live Volume Analyser */}
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/80 px-3 py-1 text-xs backdrop-blur-md">
                <span className="text-zinc-500">Voice Amp:</span>
                <div className="h-1.5 w-24 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    ref={volumeBarRef}
                    className="h-full w-0 bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-75"
                  />
                </div>
                <span ref={volumeTextRef} className="font-mono text-[10px] text-zinc-400">0%</span>
              </div>
            </div>

            {/* Floating Camera Framing Toolbar */}
            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 rounded-xl border border-zinc-800/90 bg-zinc-900/90 p-1.5 text-xs backdrop-blur-md shadow-xl">
              <span className="px-2 text-[10px] uppercase font-semibold text-zinc-500">Camera:</span>
              <button
                type="button"
                onClick={() => setCameraPreset("face")}
                className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white"
              >
                👤 Face
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset("portrait")}
                className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white"
              >
                👔 Portrait
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset("full")}
                className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white"
              >
                🧍 Full Body
              </button>
              <div className="h-4 w-px bg-zinc-700" />
              <button
                type="button"
                onClick={stopMotion}
                className="rounded-lg bg-red-950/80 border border-red-800/60 px-2.5 py-1 text-xs text-red-300 hover:bg-red-900 transition flex items-center gap-1"
              >
                <span>⏹️</span>
                <span>Stop Motion</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Control Deck */}
        <div className="flex w-[440px] xl:w-[480px] shrink-0 flex-col bg-zinc-900/40 overflow-hidden">
          {/* Category Tabs */}
          <div className="flex border-b border-zinc-800/80 bg-zinc-950/60 p-2 gap-1 overflow-x-auto scrollbar-none">
            {[
              { id: "gestures", label: "Gestures (43)", icon: "👋" },
              { id: "emotions", label: "Expressions", icon: "😊" },
              { id: "assistant", label: "Modes", icon: "🤖" },
              { id: "sandbox", label: "Speech Sandbox", icon: "🎙️" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  activeTab === tab.id
                    ? "bg-purple-600 text-white shadow-md shadow-purple-950"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: GESTURES */}
          {activeTab === "gestures" && (
            <div className="flex flex-1 flex-col overflow-hidden p-3.5">
              {/* Category Pills & Loop Toggle */}
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-zinc-800/60">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                  {Object.entries(GESTURE_CATEGORIES).map(([key, cat]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedCategory(key)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-medium transition whitespace-nowrap ${
                        selectedCategory === key
                          ? "bg-zinc-800 text-purple-300 border border-purple-800/60"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLooping}
                    onChange={(e) => setIsLooping(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-purple-600"
                  />
                  <span>Loop</span>
                </label>
              </div>

              {/* Gestures Button Grid */}
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-2">
                  {GESTURE_CATEGORIES[selectedCategory]?.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => triggerGesture(item.id)}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-left transition ${
                        activeGesture === item.id
                          ? "border-emerald-500/80 bg-emerald-950/40 text-emerald-200 shadow-md shadow-emerald-950/40"
                          : "border-zinc-800/80 bg-zinc-900/60 text-zinc-300 hover:border-purple-600/60 hover:bg-zinc-800/80 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base">{item.icon}</span>
                        <div className="truncate">
                          <p className="text-xs font-medium truncate">{item.name}</p>
                          <p className="text-[10px] font-mono text-zinc-500 truncate">{item.id}</p>
                        </div>
                      </div>
                      <span className="text-zinc-600 text-xs">▶</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FACIAL EXPRESSIONS & VISEMES */}
          {activeTab === "emotions" && (
            <div className="flex flex-1 flex-col overflow-y-auto p-3.5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Facial Emotions (Wide-Eye Presets)
                  </h3>
                  <button
                    type="button"
                    onClick={() => triggerEmotion("neutral")}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 underline"
                  >
                    Reset Neutral
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {EMOTIONS.map((emo) => (
                    <button
                      key={emo.id}
                      type="button"
                      onClick={() => triggerEmotion(emo.id)}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                        activeEmotion === emo.id
                          ? "border-amber-500/80 bg-amber-950/40 text-amber-200 shadow-md shadow-amber-950/40"
                          : "border-zinc-800/80 bg-zinc-900/60 text-zinc-300 hover:border-amber-600/60 hover:bg-zinc-800/80 hover:text-white"
                      }`}
                    >
                      <span className="text-base">{emo.icon}</span>
                      <div className="truncate">
                        <p className="text-xs font-medium truncate">{emo.name}</p>
                        <p className="text-[10px] font-mono text-zinc-500 truncate">{emo.id}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mouth Viseme Shapes */}
              <div className="border-t border-zinc-800/60 pt-3">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Phoneme Viseme Shapes (Direct Test)
                </h3>
                <div className="grid grid-cols-5 gap-1.5">
                  {["aa", "ee", "ih", "oh", "ou"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => testViseme(v)}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/80 py-2 text-center text-xs font-mono text-purple-300 hover:border-purple-600 hover:bg-purple-950/60 transition"
                    >
                      {v.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ASSISTANT MODES */}
          {activeTab === "assistant" && (
            <div className="flex flex-1 flex-col overflow-y-auto p-3.5 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Autonomous Interactive Modes
              </h3>

              {[
                {
                  id: "idle",
                  title: "Idle Mode",
                  desc: "Natural human breathing cycles, subtle postural micro-sways, random eye blinking (150ms), and 3D eye gaze tracking.",
                  icon: "🟢",
                },
                {
                  id: "listening",
                  title: "Listening Mode",
                  desc: "Attentive forward posture, receptive soft smile, focused eye contact, and autonomous affirmative nodding generator.",
                  icon: "🟣",
                },
                {
                  id: "speaking",
                  title: "Speaking Mode",
                  desc: "Conversational talking mocap, animated lip-sync visemes modulated by speech volume, and synchronized speech head nods.",
                  icon: "🔵",
                },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => triggerAssistantMode(mode.id)}
                  className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition ${
                    assistantMode === mode.id
                      ? "border-purple-600 bg-purple-950/40 text-purple-100 shadow-md shadow-purple-950/40"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{mode.icon}</span>
                    <span className="font-semibold text-sm">{mode.title}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{mode.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* TAB 4: SPEECH & DELIMITER SANDBOX */}
          {activeTab === "sandbox" && (
            <div className="flex flex-1 flex-col overflow-y-auto p-3.5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between mb-1.5">
                  <span>Preset Choreography Scripts:</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SCRIPTS.map((script, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSandboxText(script.text)}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-300 hover:border-purple-600 hover:text-white transition"
                    >
                      {script.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
                  Script with Inline Delimiters:
                </label>
                <textarea
                  value={sandboxText}
                  onChange={(e) => setSandboxText(e.target.value)}
                  rows={5}
                  placeholder="e.g. <<<gesture: greeting, expression: happy_wave>>> Hello! <<<gesture: peace_sign>>> How are you?"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs font-mono text-zinc-200 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600/50 resize-none leading-relaxed"
                />
              </div>

              {/* Speaker Voice Selection */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">
                  Edge Neural Voice Speaker:
                </label>
                <select
                  value={selectedVoice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedVoice(v);
                    setTTSVoice(v);
                  }}
                  className="w-full rounded-lg border border-zinc-700/80 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-purple-500 cursor-pointer"
                >
                  {AVAILABLE_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.icon} {v.name} — {v.tag}
                    </option>
                  ))}
                </select>
              </div>

              {/* Big Speak Button */}
              <button
                type="button"
                onClick={() => runChoreography(sandboxText)}
                disabled={assistantMode === "speaking" || !sandboxText.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-950/50 hover:from-purple-500 hover:to-indigo-500 transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <span>🗣️</span>
                <span>{assistantMode === "speaking" ? "Speaking & Choreographing..." : "Speak & Choreograph"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
