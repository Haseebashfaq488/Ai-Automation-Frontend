/**
 * AvatarChoreographer
 * Parses inline LLM gesture & expression delimiters (e.g. <<<gesture: greeting, expression: happy>>>)
 * and choreographs timed sequential 3D animations matched to the spoken duration of each phrase.
 */
export class AvatarChoreographer {
  constructor(avatar) {
    this.avatar = avatar;
    this.activeTimeouts = [];
    this.isRunning = false;
    this.currentChunkIndex = -1;
    this.chunks = [];

    // Fallback expression mapping if expression is not explicitly provided in the tag
    this.gestureToEmotionMap = {
      greeting: 'happy_wave',
      waving: 'happy_wave',
      wave: 'happy_wave',
      standing_greeting: 'happy_wave',
      salute_greeting: 'happy',
      bow: 'relaxed',
      formal_bow: 'relaxed',

      shy: 'happy',
      heart_hands: 'happy_heart',
      peace_sign: 'happy',
      cute_pose: 'happy',
      cat_pose: 'happy',
      blowing_kiss: 'happy_heart',
      blush: 'happy',
      cute_idle: 'happy',

      talking: 'happy',
      presenting: 'happy',
      nodding: 'relaxed',
      shake_no: 'sad',
      task_received: 'happy',
      pointing_thinking: 'relaxed',
      check_time: 'surprised',
      thankful: 'happy_heart',
      shrugging: 'surprised',
      thinking: 'relaxed',

      joyful_jump: 'happy_clap',
      happy_gesture: 'happy_clap',
      happy_idle: 'happy',
      encouraging: 'happy_clap',
      clapping: 'happy_clap',
      cheering: 'happy_clap',

      curious_leaning: 'relaxed',
      hands_on_hips: 'happy',
      neck_stretch: 'relaxed',
      look_around: 'neutral',
      relax: 'relaxed',
      relieved: 'relaxed',
      sleepy: 'relaxed',
      model_pose: 'happy',

      surprised: 'surprised',
      sad: 'sad',
      angry: 'angry',
      dying: 'sad'
    };
  }

  /**
   * Parse text with delimiters into timed chunks
   * Delimiter format: <<<gesture: <name>[, expression: <name>]>>>
   */
  parseTimeline(text) {
    if (!text || typeof text !== 'string') return [];

    const delimiterRegex = /<<<\s*gesture:\s*([a-zA-Z0-9_-]+)(?:,\s*expression:\s*([a-zA-Z0-9_-]+))?\s*>>>/gi;
    const chunks = [];
    let lastIndex = 0;
    let match;

    const matches = [];
    while ((match = delimiterRegex.exec(text)) !== null) {
      matches.push({
        gesture: match[1].toLowerCase(),
        expression: match[2] ? match[2].toLowerCase() : null,
        index: match.index,
        length: match[0].length
      });
    }

    // If no delimiters found, treat the entire string as a single conversational chunk
    if (matches.length === 0) {
      const clean = text.trim();
      if (!clean) return [];
      const duration = this.calculateSpokenDuration(clean);
      return [{
        gesture: 'talking',
        expression: 'happy',
        text: clean,
        durationMs: duration
      }];
    }

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const textStart = m.index + m.length;
      const textEnd = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const phrase = text.slice(textStart, textEnd).trim();

      const durationMs = this.calculateSpokenDuration(phrase);
      const expression = m.expression || this.gestureToEmotionMap[m.gesture] || 'happy';

      chunks.push({
        gesture: m.gesture,
        expression: expression,
        text: phrase,
        durationMs: durationMs
      });
    }

    return chunks;
  }

  /**
   * Estimate human spoken duration based on word count and punctuation
   */
  calculateSpokenDuration(phrase) {
    if (!phrase) return 1200;
    const words = phrase.split(/\s+/).filter(Boolean).length;
    const hasPunctuation = /[.!?,;:]/.test(phrase);
    
    // ~360ms per word + punctuation pause, minimum 1.3s for any gesture
    const calculated = words * 360 + (hasPunctuation ? 350 : 100);
    return Math.max(1300, Math.min(10000, calculated));
  }

  /**
   * Play the parsed sequence of gestures chunk by chunk
   * @param {string} fullText - Raw text containing <<<gesture: ...>>> tags
   * @param {function} onComplete - Callback when the full sequence ends
   */
  playSequence(fullText, onComplete) {
    this.stop(); // Clear any existing sequence

    this.chunks = this.parseTimeline(fullText);
    if (this.chunks.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    this.isRunning = true;
    this.currentChunkIndex = 0;

    const playNext = (index) => {
      if (!this.isRunning || index >= this.chunks.length) {
        this.isRunning = false;
        if (onComplete) onComplete();
        return;
      }

      const chunk = this.chunks[index];
      this.currentChunkIndex = index;

      // 1. Set Facial Expression
      if (this.avatar.expressions) {
        this.avatar.expressions.setEmotion(chunk.expression);
      }

      // 2. Play 3D Gesture
      if (this.avatar.animations) {
        try {
          this.avatar.animations.play(chunk.gesture, { loop: false, fadeDuration: 0.35 });
        } catch (err) {
          console.warn(`[AvatarChoreographer] Gesture '${chunk.gesture}' failed, fallback to talking:`, err);
          this.avatar.animations.play('talking', { loop: true, fadeDuration: 0.35 });
        }
      }

      // 3. Schedule next chunk after this chunk's speech duration
      const timer = setTimeout(() => {
        playNext(index + 1);
      }, chunk.durationMs);

      this.activeTimeouts.push(timer);
    };

    playNext(0);
  }

  /**
   * Stop active choreography and clear all timers
   */
  stop(fadeDuration = 0.4) {
    this.isRunning = false;
    this.currentChunkIndex = -1;
    this.chunks = [];

    // Clear all pending timeouts
    for (const t of this.activeTimeouts) {
      clearTimeout(t);
    }
    this.activeTimeouts = [];

    // Smoothly stop body animations
    if (this.avatar?.animations) {
      this.avatar.animations.stop(fadeDuration);
    }
    if (this.avatar?.expressions) {
      this.avatar.expressions.setEmotion('neutral');
    }
  }
}
