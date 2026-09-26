"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Web Speech API language presets
export const SUPPORTED_LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es-ES", label: "Spanish (ES)" },
  { code: "fr-FR", label: "French (FR)" },
  { code: "de-DE", label: "German (DE)" },
  { code: "it-IT", label: "Italian (IT)" },
  { code: "pt-BR", label: "Portuguese (BR)" },
  { code: "zh-CN", label: "Chinese (Mandarin)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ar-SA", label: "Arabic" },
  { code: "ru-RU", label: "Russian" },
  { code: "ur-PK", label: "Urdu" },
];

/**
 * Synthesizes subtle UI audio chimes using the Web Audio API without external audio files.
 */
function playAudioCue(type, audioContextRef) {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioCtx();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "start") {
      // Pleasant upward chirp: 480Hz -> 720Hz
      osc.type = "sine";
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === "stop") {
      // Gentle downward confirmation: 680Hz -> 440Hz
      osc.type = "sine";
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.14);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "error") {
      // Gentle warning double blip
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, now);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch {
    // AudioContext blocked or not allowed — fail silently
  }
}

/**
 * Custom hook for error-proof speech recognition with real-time audio visualization.
 */
export function useSpeechRecognition({
  onFinalTranscript,
  onInterimTranscript,
  onError,
  soundEffects = true,
  silenceTimeoutMs = 2800,
  autoStopOnSilence = true,
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isSecure, setIsSecure] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isActiveRef = useRef(false);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const soundEffectsRef = useRef(soundEffects);

  useEffect(() => {
    soundEffectsRef.current = soundEffects;
  }, [soundEffects]);

  // Check browser support and secure context on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasSupport = !!(
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.mozSpeechRecognition ||
      window.msSpeechRecognition
    );
    setIsSupported(hasSupport);

    const secure =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    setIsSecure(secure);

    // Try detecting default browser language
    if (navigator.language) {
      const match = SUPPORTED_LANGUAGES.find(
        (l) => l.code.toLowerCase() === navigator.language.toLowerCase()
      );
      if (match) setSelectedLanguage(match.code);
    }
  }, []);

  // Cleanup audio tracks and visualizer
  const stopAudioCapture = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      mediaStreamRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Start audio stream analyzer for live waveform & volume
  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current || !isActiveRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Map to 0-100 percentage
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      // Audio capture visualizer failed, speech recognition can still run
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (autoStopOnSilence && isActiveRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        if (isActiveRef.current) {
          stopListening();
        }
      }, silenceTimeoutMs);
    }
  }, [autoStopOnSilence, silenceTimeoutMs]);

  // Clean, error-proof stop
  const stopListening = useCallback(() => {
    if (!isActiveRef.current && !isStartingRef.current) return;
    isStoppingRef.current = true;
    isActiveRef.current = false;
    setIsListening(false);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (soundEffectsRef.current) {
      playAudioCue("stop", audioContextRef);
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    }

    stopAudioCapture();
    isStoppingRef.current = false;
    isStartingRef.current = false;
  }, [stopAudioCapture]);

  // Start speech recognition
  const startListening = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (isActiveRef.current || isStartingRef.current) {
      stopListening();
      return;
    }

    setErrorMessage(null);
    isStartingRef.current = true;

    const SpeechRec =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.mozSpeechRecognition ||
      window.msSpeechRecognition;

    if (!SpeechRec) {
      setIsSupported(false);
      setErrorMessage("Speech Recognition is not supported by your browser. Please try Chrome, Edge, or Safari.");
      isStartingRef.current = false;
      return;
    }

    // Pre-check microphone permission via getUserMedia
    try {
      await startAudioCapture();
    } catch (err) {
      isStartingRef.current = false;
      let msg = "Could not access microphone.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Microphone access blocked. Click the microphone icon in your browser URL bar to allow.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No microphone found. Please connect a microphone and try again.";
      }
      setErrorMessage(msg);
      if (onError) onError(msg);
      if (soundEffectsRef.current) playAudioCue("error", audioContextRef);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isActiveRef.current = true;
        isStartingRef.current = false;
        setIsListening(true);
        if (soundEffectsRef.current) {
          playAudioCue("start", audioContextRef);
        }
      };

      recognition.onresult = (event) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const text = item[0]?.transcript || "";
          if (item.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        if (final) {
          setTranscript((prev) => {
            const next = prev ? `${prev} ${final.trim()}` : final.trim();
            if (onFinalTranscript) onFinalTranscript(next);
            return next;
          });
          resetSilenceTimer();
        }

        setInterimTranscript(interim);
        if (onInterimTranscript) onInterimTranscript(interim);
        if (interim) {
          resetSilenceTimer();
        }
      };

      recognition.onerror = (event) => {
        let friendlyMessage = "";
        switch (event.error) {
          case "not-allowed":
          case "service-not-allowed":
            friendlyMessage = "Microphone access blocked. Please permit microphone access in your browser.";
            break;
          case "no-speech":
            // Non-critical: User simply paused or stayed quiet
            return;
          case "audio-capture":
            friendlyMessage = "No microphone device detected or device is already in use.";
            break;
          case "network":
            friendlyMessage = "Network error communicating with speech recognition service.";
            break;
          case "aborted":
            // Clean user abort, don't show error
            return;
          default:
            friendlyMessage = `Voice recognition notice: ${event.error}`;
        }

        setErrorMessage(friendlyMessage);
        if (onError) onError(friendlyMessage);
        if (soundEffectsRef.current) playAudioCue("error", audioContextRef);
        stopListening();
      };

      recognition.onend = () => {
        // Handle unexpected browser stop while we were still supposed to be active
        if (isActiveRef.current && !isStoppingRef.current) {
          // If stopped due to idle, cleanly finish
          stopListening();
        } else {
          setIsListening(false);
          stopAudioCapture();
        }
      };

      recognition.start();
    } catch (err) {
      isStartingRef.current = false;
      isActiveRef.current = false;
      setIsListening(false);
      stopAudioCapture();
      const msg = err.message || "Failed to initialize speech recognition.";
      setErrorMessage(msg);
      if (onError) onError(msg);
    }
  }, [
    selectedLanguage,
    startAudioCapture,
    stopAudioCapture,
    stopListening,
    resetSilenceTimer,
    onFinalTranscript,
    onInterimTranscript,
    onError,
  ]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      stopAudioCapture();
    };
  }, [stopAudioCapture]);

  return {
    isListening,
    isSupported,
    isSecure,
    transcript,
    interimTranscript,
    audioLevel,
    errorMessage,
    selectedLanguage,
    setSelectedLanguage,
    startListening,
    stopListening,
    resetTranscript,
    clearError,
  };
}

/**
 * Animated Sound Wave Equalizer Component that pulses with real microphone frequency data.
 */
export function AudioVisualizerWave({ level = 0, isListening = false, barCount = 14 }) {
  return (
    <div className="flex items-center gap-1 h-5 px-1">
      {Array.from({ length: barCount }).map((_, i) => {
        // Generate pseudo-frequency variation based on volume level
        const centerDistance = Math.abs(i - barCount / 2) / (barCount / 2);
        const dynamicScale = Math.max(
          0.15,
          isListening ? ((level / 100) * (1.1 - centerDistance * 0.5) + (Math.sin(i * 1.5) * 0.15)) : 0.15
        );
        const heightPercent = Math.min(100, Math.max(15, dynamicScale * 100));

        return (
          <span
            key={i}
            className="w-1 rounded-full transition-all duration-75"
            style={{
              height: `${heightPercent}%`,
              background: isListening
                ? `linear-gradient(to top, #8b5cf6, #06b6d4)`
                : "#52525b",
              opacity: isListening ? 0.9 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Full Voice Input Controller and Modal/Floating Dock for Jarvis.
 */
export default function VoiceInput({
  onTranscriptInsert,
  onAutoSend,
  onListeningChange,
  inputPlaceholder = "",
  disabled = false,
}) {
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [hotkeyNotice, setHotkeyNotice] = useState(false);

  const {
    isListening,
    isSupported,
    isSecure,
    transcript,
    interimTranscript,
    audioLevel,
    errorMessage,
    selectedLanguage,
    setSelectedLanguage,
    startListening,
    stopListening,
    resetTranscript,
    clearError,
  } = useSpeechRecognition({
    soundEffects: soundEnabled,
    autoStopOnSilence: true,
    silenceTimeoutMs: 3000,
    onFinalTranscript: (text) => {
      // If user toggled auto-send and speech paused
      if (autoSendEnabled && text.trim()) {
        // Will be triggered when user finishes or clicks stop
      }
    },
  });

  useEffect(() => {
    if (onListeningChange) {
      onListeningChange(isListening);
    }
  }, [isListening, onListeningChange]);

  const handleFinish = (shouldSend = false) => {
    const fullText = `${transcript} ${interimTranscript}`.trim();
    stopListening();
    if (fullText) {
      if (shouldSend || autoSendEnabled) {
        if (onAutoSend) onAutoSend(fullText);
        else if (onTranscriptInsert) onTranscriptInsert(fullText);
      } else {
        if (onTranscriptInsert) onTranscriptInsert(fullText);
      }
    }
    resetTranscript();
  };

  const handleCancel = () => {
    stopListening();
    resetTranscript();
  };

  // Hotkey listener: Alt + V or Ctrl + Shift + V to toggle voice recognition
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.altKey && e.code === "KeyV") || (e.ctrlKey && e.shiftKey && e.code === "KeyV")) {
        e.preventDefault();
        if (isListening) {
          handleFinish(false);
        } else {
          startListening();
          setHotkeyNotice(true);
          setTimeout(() => setHotkeyNotice(false), 2500);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="Voice recognition is not supported in this browser (Recommended: Chrome, Edge, Safari, Opera)"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-600 cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Main Microphone Action Button */}
      <button
        type="button"
        onClick={() => {
          if (isListening) {
            handleFinish(false);
          } else {
            startListening();
          }
        }}
        disabled={disabled}
        title={isListening ? "Stop listening and insert (Alt+V)" : "Voice input with AI recognition (Alt+V)"}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 outline-none ${
          isListening
            ? "bg-gradient-to-r from-red-600 to-purple-600 text-white shadow-lg shadow-purple-600/30 scale-105 ring-2 ring-purple-400 animate-pulse-subtle"
            : "border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-purple-500/60 hover:bg-zinc-800 hover:text-white"
        } disabled:opacity-40`}
      >
        {isListening ? (
          // Active listening icon / stop box
          <div className="flex items-center justify-center">
            <span className="h-3 w-3 rounded-sm bg-white" />
          </div>
        ) : (
          // Crisp modern microphone SVG
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )}

        {/* Pulsing ring during listening */}
        {isListening && (
          <span className="absolute -inset-1 rounded-xl bg-purple-500/20 blur-sm animate-ping pointer-events-none" />
        )}
      </button>

      {/* Floating Active Voice Dock when Listening */}
      {isListening && (
        <div className="fixed inset-x-3 bottom-20 z-50 sm:absolute sm:inset-auto sm:bottom-14 sm:right-0 sm:w-96 rounded-2xl border border-purple-500/40 bg-zinc-900/95 p-4 shadow-2xl shadow-purple-950/60 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Header with Visualizer and Status */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                Listening…
              </span>
            </div>

            {/* Audio Wave Visualizer */}
            <AudioVisualizerWave level={audioLevel} isListening={isListening} barCount={12} />

            {/* Quick Actions / Settings */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Mute audio cues" : "Unmute audio cues"}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 text-xs"
              >
                {soundEnabled ? "🔔" : "🔕"}
              </button>

              <button
                type="button"
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-medium text-zinc-300 hover:border-zinc-700"
              >
                {selectedLanguage} ▾
              </button>
            </div>
          </div>

          {/* Language selector dropdown */}
          {showLanguageMenu && (
            <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-1 text-xs shadow-xl">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setSelectedLanguage(lang.code);
                    setShowLanguageMenu(false);
                    // restart with new language
                    stopListening();
                    setTimeout(startListening, 150);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-left ${
                    selectedLanguage === lang.code
                      ? "bg-purple-900/50 text-purple-200 font-medium"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  <span>{lang.label}</span>
                  <span className="font-mono text-[10px] text-zinc-500">{lang.code}</span>
                </button>
              ))}
            </div>
          )}

          {/* Real-time Transcript Stream Box */}
          <div className="mt-3 min-h-[58px] max-h-28 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-2.5 text-xs">
            {transcript || interimTranscript ? (
              <p className="leading-relaxed">
                <span className="text-zinc-100">{transcript}</span>
                {interimTranscript && (
                  <span className="text-purple-400 italic"> {interimTranscript}</span>
                )}
              </p>
            ) : (
              <p className="text-zinc-500 italic">Speak clearly into your microphone…</p>
            )}
          </div>

          {/* Footer Controls */}
          <div className="mt-3 flex items-center justify-between gap-2 pt-1">
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSendEnabled}
                onChange={(e) => setAutoSendEnabled(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-purple-500/40"
              />
              <span>Auto-send</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleFinish(false)}
                className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-purple-500"
              >
                Done
              </button>

              <button
                type="button"
                onClick={() => handleFinish(true)}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:from-emerald-500 hover:to-teal-500"
              >
                Send ↵
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error / Alert Banner */}
      {errorMessage && (
        <div className="fixed inset-x-3 bottom-20 z-50 sm:absolute sm:inset-auto sm:bottom-14 sm:right-0 sm:w-80 rounded-2xl border border-red-800/80 bg-red-950/95 p-3.5 shadow-2xl text-xs text-red-200 backdrop-blur-xl animate-in fade-in duration-150">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-red-300">
              <span>⚠️</span>
              <span>Voice Error</span>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="text-red-400 hover:text-red-100 text-xs px-1"
            >
              ✕
            </button>
          </div>
          <p className="mt-1.5 text-zinc-300 leading-relaxed">{errorMessage}</p>
          {!isSecure && (
            <p className="mt-1 text-[11px] text-amber-300">
              Note: Browsers require HTTPS or localhost for microphone access.
            </p>
          )}
        </div>
      )}

      {/* Hotkey helper tooltip */}
      {hotkeyNotice && (
        <div className="fixed inset-x-4 bottom-20 z-50 sm:absolute sm:inset-auto sm:bottom-12 sm:right-0 text-center sm:text-left rounded-lg border border-purple-800 bg-zinc-950 px-2.5 py-1 text-[11px] text-purple-300 shadow-lg">
          🎙️ Voice Recognition active (Alt+V to stop)
        </div>
      )}
    </div>
  );
}
