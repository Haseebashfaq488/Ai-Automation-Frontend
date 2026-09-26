/**
 * SemanticCueEngine
 * Lightweight, zero-latency conversational body language dispatcher.
 * Analyzes natural language sentences from Antigravity in real-time and
 * directs the 3D avatar's animations and facial emotions.
 * 
 * Features:
 * - Zero LLM prompt overhead / zero API cost / 0ms network latency
 * - Debounced gesture cooldown (avoids skeletal jitter or abrupt cutting)
 * - Safe fallback to conversational talking (never freezes or crashes)
 */
export class SemanticCueEngine {
  constructor(avatar) {
    this.avatar = avatar;
    this.lastTriggerTime = 0;
    this.cooldownSeconds = 2.8; // Minimum duration before switching non-idle gestures
    this.currentGesture = null;

    // Pattern dictionary matching natural phrasing to available .vrma animations
    this.cueRules = [
      // 1. Greetings & Warm Welcomes
      {
        pattern: /\b(hi+|hello+|hey+|welcome|good\s+(morning|afternoon|evening)|what'?s\s*up+|sup|howdy|greetings)\b/i,
        gesture: 'waving',
        emotion: 'happy_wave',
        priority: 10
      },

      // 2. High Celebrations & Praise
      {
        pattern: /\b(awesome|congratulations|great job|hurray|woohoo|fantastic|wonderful|yay|hooray)\b/i,
        gesture: 'clapping',
        emotion: 'happy_clap',
        priority: 9
      },

      // 3. Task Success / Completion
      {
        pattern: /\b(done|finished|completed|sent|delivered|saved|created|executed|all set)\b/i,
        gesture: 'task_received',
        emotion: 'happy',
        priority: 8
      },

      // 4. Gratitude & Warm Affection
      {
        pattern: /\b(thank you|thanks|grateful|appreciate|my pleasure)\b/i,
        gesture: 'thankful',
        emotion: 'happy_heart',
        priority: 7
      },

      // 5. Apology, Disappointment & Refusal
      {
        pattern: /\b(sorry|unfortunately|failed|error|cannot|could not|unable|impossible|cancelled)\b/i,
        gesture: 'shake_no',
        emotion: 'sad',
        priority: 8
      },

      // 6. Deep Thinking & Searching / Processing
      {
        pattern: /\b(let me check|thinking|searching|analyzing|calculating|reading|querying|fetching|processing|running)\b/i,
        gesture: 'pointing_thinking',
        emotion: 'relaxed',
        priority: 6
      },

      // 7. Uncertainty & Confusion
      {
        pattern: /\b(not sure|why|how come|perhaps|wondering|curious)\b/i,
        gesture: 'shrugging',
        emotion: 'surprised',
        priority: 5
      }
    ];
  }

  /**
   * Process a chunk or complete sentence from Antigravity
   * @param {string} text - Raw conversational text
   * @param {object} options - Optional flags (e.g. force: true)
   */
  processText(text, options = {}) {
    if (!text || typeof text !== 'string') return;
    if (!this.avatar || !this.avatar.animations) return;

    const now = performance.now() / 1000;
    const isForced = options.force || false;

    // Check cooldown unless forced
    if (!isForced && (now - this.lastTriggerTime < this.cooldownSeconds)) {
      return;
    }

    // Split into sentences or clean thought segments
    const cleanText = text.replace(/<[^>]*>?/gm, '').trim();

    // Find highest priority matching cue
    let matchedCue = null;
    for (const rule of this.cueRules) {
      if (rule.pattern.test(cleanText)) {
        if (!matchedCue || rule.priority > matchedCue.priority) {
          matchedCue = rule;
        }
      }
    }

    if (matchedCue) {
      this.playCue(matchedCue.gesture, matchedCue.emotion);
      this.lastTriggerTime = now;
      return;
    }

    // If no specific emotional cue matched and avatar isn't already gesturing,
    // play standard natural conversational talking
    if (!this.avatar.animations.hasActiveAction() || this.avatar.animations.activeAnimationName !== 'talking') {
      this.playTalking();
      this.lastTriggerTime = now;
    }
  }

  /**
   * Play specific gesture with smooth cross-fade and tailored expression
   */
  async playCue(gestureName, emotionName) {
    this.currentGesture = gestureName;
    if (this.avatar.expressions && emotionName) {
      this.avatar.expressions.setEmotion(emotionName);
    }

    try {
      if (this.avatar.animations) {
        await this.avatar.animations.play(gestureName, { loop: false, fadeDuration: 0.35 });
      }
    } catch (err) {
      console.warn(`[SemanticCueEngine] Failed to play gesture '${gestureName}', falling back to talking:`, err);
      this.playTalking();
    }
  }

  /**
   * Default conversational posture with speech lip-sync
   */
  async playTalking() {
    this.currentGesture = 'talking';
    if (this.avatar.expressions) {
      this.avatar.expressions.setEmotion('happy');
    }
    if (this.avatar.animations) {
      try {
        await this.avatar.animations.play('talking', { loop: true, fadeDuration: 0.4 });
      } catch (e) {
        // Fall back gracefully
      }
    }
  }

  /**
   * Return to relaxed idle state when speech finishes
   */
  stop(fadeDuration = 0.5) {
    this.currentGesture = null;
    if (this.avatar.animations) {
      this.avatar.animations.stop(fadeDuration);
    }
    if (this.avatar.expressions) {
      this.avatar.expressions.setEmotion('neutral');
    }
  }
}
