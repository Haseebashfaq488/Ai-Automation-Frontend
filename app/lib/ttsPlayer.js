import { apiFetch } from "./api";

/**
 * ttsPlayer
 * Singleton audio player that fetches and plays Microsoft Edge Neural TTS audio
 * streamed from the backend endpoint `/agent/tts`.
 */

let currentAudio = null;
let currentAudioUrl = null;
let isMuted = false;

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

/**
 * Synthesize and play speech for a given text message.
 * @param {string} text - Message containing text and optional <<<gesture>>> tags
 * @param {object} callbacks - { onStart, onEnd, onError }
 * @returns {Promise<void>}
 */
export async function playTTS(text, { onStart, onEnd, onError } = {}) {
  // Always stop previous audio immediately
  stopTTS();

  if (isMuted || !text || typeof text !== "string") {
    onEnd?.();
    return;
  }

  try {
    const res = await apiFetch("/agent/tts", {
      method: "POST",
      body: JSON.stringify({
        text,
        voice: "en-US-AvaNeural",
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

    audio.onplay = () => {
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
