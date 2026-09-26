"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AvatarScene } from "./AvatarScene.js";
import { AvatarLoader } from "./AvatarLoader.js";
import { VRMAvatar } from "./VRMAvatar.js";
import { AvatarChoreographer } from "./AvatarChoreographer.js";

/**
 * AvatarCanvas
 * React component wrapping the 3D VRM Avatar, Three.js renderer,
 * and the speech-timed AvatarChoreographer.
 * 
 * Props:
 * - assistantState: 'idle' | 'listening' | 'speaking'
 * - currentMessage: Latest speech text from Antigravity containing <<<gesture: ...>>> tags
 * - isVoiceActive: Boolean indicating user microphone state
 * - isTextActive: Boolean indicating user typing or input active
 * - onLoaded: Optional callback fired when VRM is fully loaded
 */
export default function AvatarCanvas({
  assistantState = "idle",
  currentMessage = "",
  isVoiceActive = false,
  isTextActive = false,
  onLoaded,
  className = "",
}) {
  const containerRef = useRef(null);
  const avatarRef = useRef(null);
  const sceneRef = useRef(null);
  const choreographerRef = useRef(null);
  const animFrameIdRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);

  // 1. Mount & Initialize 3D Avatar
  useEffect(() => {
    let isMounted = true;
    const container = containerRef.current;
    if (!container) return;

    // Initialize Three.js Scene
    const scene = new AvatarScene(container);
    sceneRef.current = scene;

    const loader = new AvatarLoader();

    async function loadModel() {
      try {
        const { vrm, inspection } = await loader.load("/avatar/model.vrm", (progress) => {
          if (progress.total > 0 && isMounted) {
            setLoadProgress(Math.round((progress.loaded / progress.total) * 100));
          }
        });

        if (!isMounted) {
          scene.destroy();
          return;
        }

        // Add VRM to scene and frame upper torso / portrait
        scene.scene.add(vrm.scene);
        scene.frameAvatar(vrm);

        // Instantiate coordinator & speech-timed choreographer
        const avatar = new VRMAvatar(vrm, scene.camera, inspection);
        const choreographer = new AvatarChoreographer(avatar);

        avatarRef.current = avatar;
        choreographerRef.current = choreographer;

        setIsLoading(false);
        if (onLoaded) onLoaded({ avatar, inspection });

        // Start render loop
        const clock = new THREE.Clock();
        function animate() {
          animFrameIdRef.current = requestAnimationFrame(animate);
          const delta = Math.min(clock.getDelta(), 0.05);

          avatar.update(delta);
          scene.render();
        }
        animate();
      } catch (err) {
        console.error("[AvatarCanvas] Error loading VRM model:", err);
        if (isMounted) {
          setLoadError(err.message || "Failed to load 3D Avatar");
          setIsLoading(false);
        }
      }
    }

    loadModel();

    return () => {
      isMounted = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (sceneRef.current) {
        sceneRef.current.destroy();
      }
    };
  }, [onLoaded]);

  // 2. React to Assistant State changes (listening / speaking / idle)
  useEffect(() => {
    const avatar = avatarRef.current;
    if (!avatar || !avatar.assistant) return;

    if (isVoiceActive || isTextActive || assistantState === "listening") {
      // 1. Immediately cut off any running choreography or animations
      if (choreographerRef.current) {
        choreographerRef.current.stop(0.35);
      }
      if (avatar.animations && avatar.animations.hasActiveAction()) {
        avatar.animations.stop(0.35);
      }

      // 2. Switch to attentive listening mode (attentive posture, eye contact, affirmative nods)
      avatar.assistant.setMode("listening");
    } else if (assistantState === "speaking") {
      avatar.assistant.setMode("speaking");
    } else {
      avatar.assistant.setMode("idle");
      if (choreographerRef.current) {
        choreographerRef.current.stop(0.4);
      }
    }
  }, [assistantState, isVoiceActive, isTextActive]);

  // 3. React to new message updates: Run speech-timed delimiter choreography!
  useEffect(() => {
    if (!currentMessage || !choreographerRef.current) return;

    // CRITICAL: If user is typing or voice input is active, never play speaking sequence
    if (isTextActive || isVoiceActive) {
      choreographerRef.current.stop(0.3);
      if (avatarRef.current?.assistant) {
        avatarRef.current.assistant.setMode("listening");
      }
      return;
    }

    if (assistantState === "speaking") {
      choreographerRef.current.playSequence(currentMessage, () => {
        if (avatarRef.current?.assistant) {
          avatarRef.current.assistant.setMode("idle");
        }
      });
    }
  }, [currentMessage, assistantState, isTextActive, isVoiceActive]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-2xl ${className}`}>
      {/* 3D Canvas Viewport */}
      <div ref={containerRef} className="h-full w-full min-h-[300px]" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="mt-3 text-xs font-medium text-zinc-300">
            Loading Jarvis Avatar... {loadProgress > 0 ? `${loadProgress}%` : ""}
          </p>
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-red-950/80 backdrop-blur-sm">
          <p className="text-xs text-red-300 font-medium">Failed to load avatar</p>
          <p className="mt-1 text-[11px] text-red-400/80">{loadError}</p>
        </div>
      )}

      {/* Subtle State Badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-900/80 px-2.5 py-1 text-[11px] backdrop-blur-md">
        <span
          className={`h-2 w-2 rounded-full ${
            assistantState === "speaking"
              ? "animate-pulse bg-emerald-400"
              : assistantState === "listening" || isVoiceActive
              ? "animate-ping bg-purple-400"
              : "bg-zinc-500"
          }`}
        />
        <span className="text-zinc-300 font-medium capitalize">
          {assistantState === "speaking"
            ? "Speaking"
            : assistantState === "listening" || isVoiceActive
            ? "Listening"
            : "Jarvis Avatar"}
        </span>
      </div>
    </div>
  );
}
