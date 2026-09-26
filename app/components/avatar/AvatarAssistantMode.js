import * as THREE from 'three';
import { getLiveAudioVolume } from '../../lib/ttsPlayer.js';

/**
 * AvatarAssistantMode
 * Coordinates the two essential interactive states for an AI Personal Assistant:
 * 1. LISTENING MODE:
 *    - Attentive posture leaning softly forward towards the user
 *    - Receptive, interested soft smile (relaxed + happy blend)
 *    - Focused eye gaze tracking the user
 *    - Autonomous affirmative nods of understanding (micro-nods at natural human cadences)
 *
 * 2. SPEAKING MODE:
 *    - Natural conversational gesturing (plays 'talking' mocap or procedural arm gestures)
 *    - Real-time continuous lip-sync with realistic speech cadence (vowel visemes: aa, ee, ih, oh, ou)
 *    - Syllable variation and conversational breathing pauses
 *    - Synchronous speech head nods and micro-cadence
 */
export class AvatarAssistantMode {
  constructor(avatar) {
    this.avatar = avatar;
    this.mode = 'idle'; // 'idle' | 'listening' | 'speaking'

    // --- Listening State Parameters ---
    this.listenTime = 0;
    this.nextNodTime = 2.0 + Math.random() * 2.0;
    this.nodActive = false;
    this.nodTime = 0;
    this.nodDuration = 0.75;
    this.nodType = 1; // 1 = single nod, 2 = double micro-nod

    // --- Speaking / Lip-sync Parameters ---
    this.speakingTime = 0;
    this.currentViseme = 'none';
    this.targetVisemeIntensity = 0;
    this.currentVisemeIntensity = 0;
    this.phonemeTimer = 0;
    this.phonemeDuration = 0.14;
    this.isSpeechPause = false;
    this.pauseDuration = 0;
    this.phonemeIndex = 0;
    this.visemes = ['aa', 'ee', 'oh', 'ih', 'ou', 'aa', 'ih', 'ee'];

    // Procedural speech head bob
    this.speechHeadOffset = { pitch: 0, yaw: 0, roll: 0 };
  }

  /**
   * Set assistant mode: 'idle', 'listening', or 'speaking'
   * @param {string} mode
   */
  setMode(mode) {
    if (this.mode === mode) return;
    const prevMode = this.mode;
    this.mode = mode;
    console.log(`[AvatarAssistantMode] Mode changed: ${prevMode} -> ${mode}`);

    if (mode === 'listening') {
      this.initListening();
    } else if (mode === 'speaking') {
      this.initSpeaking();
    } else {
      this.initIdle();
    }
  }

  initListening() {
    this.listenTime = 0;
    // Fast initial nod (0.35s - 0.7s) to immediately acknowledge user input
    this.nextNodTime = 0.35 + Math.random() * 0.35;
    this.nodActive = false;

    // Set receptive, warm listening expression
    this.avatar.expressions.setEmotion('nodding');
    this.avatar.expressions.setViseme('none', 0);

    // Stop active gestures and smoothly transition to attentive posture
    if (this.avatar.animations) {
      this.avatar.animations.stop(0.3);
    }
  }

  initSpeaking() {
    this.speakingTime = 0;
    this.phonemeTimer = 0;
    this.phonemeIndex = 0;
    this.isSpeechPause = false;

    // Friendly conversational expression
    this.avatar.expressions.setEmotion('happy');

    // Trigger conversational gestures animation
    this.avatar.animations.play('talking', { loop: true, fadeDuration: 0.4 });
  }

  initIdle() {
    // Reset mouth visemes and return to neutral resting expression
    this.avatar.expressions.setViseme('none', 0);
    this.avatar.expressions.setEmotion('neutral');
    this.speechHeadOffset = { pitch: 0, yaw: 0, roll: 0 };

    if (this.avatar.animations.activeAnimationName === 'talking') {
      this.avatar.animations.stop(0.4);
    }
  }

  /**
   * Update assistant behaviors every frame
   * @param {number} delta
   */
  update(delta) {
    if (this.mode === 'listening') {
      this.updateListening(delta);
    } else if (this.mode === 'speaking') {
      this.updateSpeaking(delta);
    }
  }

  /**
   * Update attentive listening behaviors
   */
  updateListening(delta) {
    this.listenTime += delta;

    // Maintain attentive open-eyed listening expression
    this.avatar.expressions.setEmotion('nodding');

    // Affirmative Nodding Generator (indicates "I understand, please continue")
    if (!this.nodActive) {
      if (this.listenTime >= this.nextNodTime) {
        this.nodActive = true;
        this.nodTime = 0;
        this.nodDuration = 0.7 + Math.random() * 0.3;
        this.nodType = Math.random() > 0.35 ? 2 : 1; // 65% double micro-nod, 35% single nod
      }
    } else {
      this.nodTime += delta;
      const progress = this.nodTime / this.nodDuration;

      if (progress >= 1.0) {
        this.nodActive = false;
        this.listenTime = 0;
        this.nextNodTime = 1.8 + Math.random() * 2.2; // Next nod in 1.8 - 4.0s
      } else {
        const headNode = this.avatar.vrm.humanoid?.getNormalizedBoneNode('head');
        const neckNode = this.avatar.vrm.humanoid?.getNormalizedBoneNode('neck');
        if (headNode) {
          // Double nod or single smooth nod sine wave
          const freq = this.nodType === 2 ? Math.PI * 4 : Math.PI * 2;
          const envelope = Math.sin(progress * Math.PI); // smooth in/out envelope
          const nodAngle = Math.sin(progress * freq) * 0.11 * envelope;

          // Apply natural forward nod to head and neck
          headNode.rotation.x += nodAngle;
          if (neckNode) {
            neckNode.rotation.x += nodAngle * 0.45;
          }
        }
      }
    }
  }

  /**
   * Update speaking behaviors and realistic audio-driven lip-sync visemes
   */
  updateSpeaking(delta) {
    this.speakingTime += delta;
    this.phonemeTimer += delta;

    // Read live audio volume from Web Audio API analyser
    const liveVolume = getLiveAudioVolume();
    const isAudioSilent = liveVolume < 0.04;

    // 1. Viseme Switching modulated by actual audio volume
    if (isAudioSilent) {
      // Natural silence/pause in speech: mouth closes
      this.targetVisemeIntensity = 0;
    } else {
      if (this.phonemeTimer >= this.phonemeDuration) {
        this.phonemeTimer = 0;
        this.phonemeDuration = 0.08 + Math.random() * 0.10;
        this.phonemeIndex = (this.phonemeIndex + 1) % this.visemes.length;
        this.currentViseme = this.visemes[this.phonemeIndex];
      }
      // Target mouth intensity is directly driven by spoken volume!
      this.targetVisemeIntensity = Math.min(1.0, 0.25 + liveVolume * 0.85);
    }

    // 2. Smoothly interpolate active viseme
    const blendRate = 1.0 - Math.exp(-22.0 * delta);
    this.currentVisemeIntensity += (this.targetVisemeIntensity - this.currentVisemeIntensity) * blendRate;

    // Apply visemes directly to VRM Expression Manager
    if (this.avatar.vrm.expressionManager) {
      for (const v of ['aa', 'ee', 'ih', 'oh', 'ou']) {
        if (v === this.currentViseme && !this.isSpeechPause) {
          this.avatar.vrm.expressionManager.setValue(v, this.currentVisemeIntensity);
        } else {
          // fade out other visemes
          const curVal = this.avatar.vrm.expressionManager.getValue(v) || 0;
          if (curVal > 0.01) {
            this.avatar.vrm.expressionManager.setValue(v, curVal * 0.82);
          } else {
            this.avatar.vrm.expressionManager.setValue(v, 0);
          }
        }
      }
    }

    // 3. Conversational head micro-cadence (syncs with speech rhythm)
    const headNode = this.avatar.vrm.humanoid?.getNormalizedBoneNode('head');
    const neckNode = this.avatar.vrm.humanoid?.getNormalizedBoneNode('neck');
    if (headNode && neckNode) {
      const speechRhythm = Math.sin(this.speakingTime * 5.2) * 0.025 * this.currentVisemeIntensity;
      const speechTilt = Math.cos(this.speakingTime * 2.8) * 0.018;
      headNode.rotation.x += speechRhythm;
      headNode.rotation.z += speechTilt;
      neckNode.rotation.x += speechRhythm * 0.5;
    }
  }
}
