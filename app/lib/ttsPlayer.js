import { apiFetch } from "./api";

/**
 * ttsPlayer
 * Singleton audio player that fetches and plays Microsoft Edge Neural TTS audio
 * streamed from the backend endpoint `/agent/tts`.
 * Provides real-time volume analysis for audio-driven 3D lipsync.
 */

let currentAudio = null;
let currentAudioUrl = null;
let isMuted = false;
let currentVoice = "en-US-AvaNeural";

export const AVAILABLE_VOICES = [
  { id: "en-US-AvaNeural", name: "Ava", tag: "Natural & Warm", icon: "🌸" },
  { id: "en-US-AnaNeural", name: "Ana", tag: "Youthful & Cute", icon: "✨" },
  { id: "en-US-AriaNeural", name: "Aria", tag: "Expressive & Clear", icon: "🎙️" },
  { id: "en-US-EmmaNeural", name: "Emma", tag: "British & Cheerful", icon: "☕" },
  { id: "en-US-JennyNeural", name: "Jenny", tag: "Calm Assistant", icon: "💼" },
  { id: "en-US-AndrewNeural", name: "Andrew", tag: "Warm Male", icon: "👔" },
];

if (typeof window !== "undefined") {
  try {
    const saved = window.localStorage.getItem("jarvis_tts_voice");
    if (saved) currentVoice = saved;
  } catch {
    // ignore
  }
}

export function setTTSVoice(voiceId) {
  if (voiceId && typeof voiceId === "string") {
    currentVoice = voiceId;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("jarvis_tts_voice", voiceId);
      } catch {
        // ignore
      }
    }
  }
}

export function getTTSVoice() {
  return currentVoice;
}

let audioCtx = null;
let analyser = null;
let currentSource = null;
let frequencyData = null;

function setupAudioAnalysis(audio) {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.3;
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
    }

    try {
      if (currentSource) {
        currentSource.disconnect();
      }
      currentSource = audioCtx.createMediaElementSource(audio);
      currentSource.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch {
      // Fallback: standard audio output
    }
  } catch (err) {
    console.warn("[ttsPlayer] Audio analysis setup:", err);
  }
}

export function getLiveAudioVolume() {
  if (!currentAudio || currentAudio.paused) return 0;
  if (!analyser || !frequencyData) {
    return 0.4; // Graceful non-zero volume fallback while playing
  }
  try {
    analyser.getByteFrequencyData(frequencyData);
    let sum = 0;
    const count = Math.min(frequencyData.length, 16);
    for (let i = 0; i < count; i++) {
      sum += frequencyData[i];
    }
    const avg = sum / (count * 255);
    return Math.min(1.0, avg * 2.5);
  } catch {
    return 0.4;
  }
}

export function getCurrentAudio() {
  return currentAudio;
}

export function setTTSMuted(muted) {
  isMuted = Boolean(muted);
  if (isMuted) {
    stopTTS();
  }
}

export function isTTSMuted() {
  return isMuted;
}

export function isTTSPlaying() {
  return Boolean(currentAudio && !currentAudio.paused);
}

export function stopTTS() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  if (currentAudioUrl) {
    try {
      URL.revokeObjectURL(currentAudioUrl);
    } catch {
      // ignore
    }
    currentAudioUrl = null;
  }
}

export function cleanTextForSpeech(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<<<[^>]+>>>/g, "") // strip inline gesture tags
    .replace(/```[\s\S]*?```/g, "") // strip code blocks
    .replace(/`[^`]*`/g, "") // strip inline code
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // clean markdown links
    .replace(/[\p{Extended_Pictographic}\p{Emoji}\u2600-\u27BF\uFE0E\uFE0F]/gu, "") // strip all emojis
    .replace(/[*_~#]/g, "") // clean markdown styling
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Synthesize and play speech for a given text message.
 * @param {string} text - Message containing text and optional <<<gesture>>> tags
 * @param {object} callbacks - { onStart, onPlay, onEnd, onError }
 * @returns {Promise<void>}
 */
export async function playTTS(text, { voice, onStart, onPlay, onEnd, onError } = {}) {
  // Always stop previous audio immediately
  stopTTS();

  if (isMuted || !text || typeof text !== "string") {
    onEnd?.();
    return;
  }

  const sanitized = cleanTextForSpeech(text);
  if (!sanitized) {
    onEnd?.();
    return;
  }

  try {
    const voiceToUse = voice || currentVoice || "en-US-AvaNeural";
    const res = await apiFetch("/agent/tts", {
      method: "POST",
      body: JSON.stringify({
        text: sanitized,
        voice: voiceToUse,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `TTS synthesis failed (${res.status})`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    currentAudioUrl = url;

    const audio = new Audio(url);
    currentAudio = audio;

    // Attach Web Audio API analyser for live lipsync
    setupAudioAnalysis(audio);

    audio.onplay = () => {
      onPlay?.({ audio, duration: audio.duration });
      onStart?.();
    };

    audio.onended = () => {
      stopTTS();
      onEnd?.();
    };

    audio.onerror = (e) => {
      stopTTS();
      onError?.(e);
      onEnd?.();
    };

    await audio.play();
  } catch (err) {
    stopTTS();
    console.warn("[ttsPlayer] Audio play failed:", err);
    onError?.(err);
    onEnd?.();
  }
}
