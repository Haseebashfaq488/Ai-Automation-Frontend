/**
 * AvatarBlink
 * Implements realistic autonomous eyelid blinking with randomized intervals,
 * natural blink curves, and occasional double-blinks.
 */
export class AvatarBlink {
  constructor(vrm) {
    this.vrm = vrm;
    this.expressionManager = vrm.expressionManager;

    // Detect available blink expression name
    this.blinkNames = this.detectBlinkExpressions();

    // Blink state
    this.timer = this.getRandomInterval();
    this.isBlinking = false;
    this.blinkProgress = 0;
    this.blinkDuration = 0.16; // Quick natural blink (~160ms)
    this.queuedDoubleBlink = false;
  }

  detectBlinkExpressions() {
    if (!this.expressionManager) return [];

    // 1. Check standard VRM preset 'blink'
    if (this.expressionManager.getExpression('blink')) {
      return ['blink'];
    }

    // 2. Check separate left and right blink presets
    const left = this.expressionManager.getExpression('blinkLeft');
    const right = this.expressionManager.getExpression('blinkRight');
    if (left && right) {
      return ['blinkLeft', 'blinkRight'];
    }

    // 3. Check common variant names
    const candidates = ['Blink', 'blink_l', 'blink_r', 'blinkLeft', 'blinkRight'];
    for (const name of candidates) {
      if (this.expressionManager.getExpression(name)) {
        return [name];
      }
    }

    return ['blink'];
  }

  getRandomInterval() {
    // 2.2 to 5.5 seconds interval between blinks
    return 2.2 + Math.random() * 3.3;
  }

  /**
   * Update blink state
   * @param {number} delta - Frame delta time in seconds
   */
  update(delta) {
    if (!this.expressionManager || this.blinkNames.length === 0) return;

    if (!this.isBlinking) {
      this.timer -= delta;
      if (this.timer <= 0) {
        this.startBlink();
      }
    } else {
      this.blinkProgress += delta / this.blinkDuration;

      let weight = 0;
      if (this.blinkProgress <= 0.45) {
        // Rapid eye closing (0 -> 1)
        const t = this.blinkProgress / 0.45;
        weight = t * t * (3 - 2 * t); // Smoothstep
      } else if (this.blinkProgress <= 1.0) {
        // Slightly slower reopening (1 -> 0)
        const t = (this.blinkProgress - 0.45) / 0.55;
        weight = 1 - t * t * (3 - 2 * t); // Smoothstep
      } else {
        // Blink finished
        weight = 0;
        this.isBlinking = false;

        if (this.queuedDoubleBlink) {
          // Trigger double blink after tiny pause (80-120ms)
          this.queuedDoubleBlink = false;
          this.timer = 0.08 + Math.random() * 0.06;
        } else {
          this.timer = this.getRandomInterval();
        }
      }

      // Apply blink weight (0 to 1 during blink, 0 when finished so eyes stay fully open)
      for (const name of this.blinkNames) {
        this.expressionManager.setValue(name, Math.max(0, Math.min(1, weight)));
      }
    }
  }

  startBlink() {
    this.isBlinking = true;
    this.blinkProgress = 0;
    this.blinkDuration = 0.14 + Math.random() * 0.04;

    // ~12% chance for an organic double-blink
    this.queuedDoubleBlink = Math.random() < 0.12;
  }
}
