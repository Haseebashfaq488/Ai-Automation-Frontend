import { AvatarPose } from './AvatarPose.js';
import { AvatarBreathing } from './AvatarBreathing.js';
import { AvatarBlink } from './AvatarBlink.js';
import { AvatarGaze } from './AvatarGaze.js';
import { AvatarIdle } from './AvatarIdle.js';
import { AvatarExpression } from './AvatarExpression.js';
import { AvatarGestures } from './AvatarGestures.js';
import { VRMAnimationManager } from './VRMAnimationManager.js';
import { AvatarAssistantMode } from './AvatarAssistantMode.js';

/**
 * VRMAvatar
 * Encapsulates the VRM model instance and coordinates independent, layered autonomous animation sub-systems.
 */
export class VRMAvatar {
  constructor(vrm, camera, inspection) {
    this.vrm = vrm;
    this.camera = camera;
    this.inspection = inspection;

    // 1. Apply natural human resting posture (relax arms from T-pose, curl fingers, natural spine)
    this.pose = new AvatarPose(vrm);

    // 2. Initialize VRMA animation clip manager (Mocap clips: Clapping, Waving, Thinking, etc.)
    this.animations = new VRMAnimationManager(vrm);

    // 3. Initialize autonomous procedural subsystems
    this.expressions = new AvatarExpression(vrm);
    this.gestures = new AvatarGestures(vrm);
    this.breathing = new AvatarBreathing(vrm);
    this.blink = new AvatarBlink(vrm);
    this.gaze = new AvatarGaze(vrm, camera);
    this.idle = new AvatarIdle(vrm);

    // 4. Personal Assistant Interactive Modes (Listening with affirmative nods, Speaking with dynamic lip-sync)
    this.assistant = new AvatarAssistantMode(this);
  }

  /**
   * Main per-frame update loop.
   * Runs all autonomous layers simultaneously, followed by the VRM runtime update.
   * @param {number} delta - Frame time in seconds
   */
  update(delta) {
    const isCustomIdle = (this.animations.activeAnimationName === 'custom_idle_8s');

    if (isCustomIdle && this.animations.currentAction) {
      // 8-second cyclical emotional & speech timeline:
      // 0-2s: Sad | 2-4s: Happy | 4-6s: Angry & Pouting | 6-8s: Speaks "ah" & "eh"
      const animTime = (this.animations.currentAction.time % 8.0);
      this.updateCustomIdleTimeline(animTime);
    } else {
      // 1. Smooth emotional expressions
      this.expressions.update(delta);
    }
    const emoOffsets = this.expressions.getBodyOffsets();

    // 2. Skeletal Motion: Animation mixer updates every frame
    this.animations.update(delta);

    // If no mocap animation is driving the skeleton, run procedural idle & breathing
    if (!this.animations.hasActiveAction()) {
      this.gestures.setEmotion(this.expressions.activeEmotion);
      const breathCycle = this.breathing.getBreathCycle();
      this.gestures.update(delta, breathCycle);

      this.idle.update(delta, emoOffsets);
      this.breathing.update(delta, emoOffsets);
    }

    // 3. Assistant interactive modes (Listening nods / Speaking dynamic lip-sync)
    this.assistant.update(delta);

    // 4. Facial and secondary systems (always active)
    this.blink.update(delta);
    this.gaze.update(delta);

    // 5. Official VRM runtime update (spring bones hair/cloth physics + expressions + lookAt)
    this.vrm.update(delta);
  }

  /**
   * 8-Second Custom Idle Expression & Speech Timeline:
   * 1. 0.0s - 2.0s: Sad (drooping brows, downturned mouth, sorrowful gaze)
   * 2. 2.0s - 4.0s: Happy (radiant wide-open smile, joyous brows, cheerful perk)
   * 3. 4.0s - 6.0s: Angry & Pouting (knit brows, glare, cute pouting mouth)
   * 4. 6.0s - 8.0s: Speaks 2 words: "ah" (6.2s - 6.8s) & "eh" (7.1s - 7.7s) -> Loops to Sad
   * @param {number} t - Current playback time in seconds (0.0 to 8.0)
   */
  updateCustomIdleTimeline(t) {
    const vrm = this.vrm;
    const exp = this.expressions;
    const faceMesh = exp.faceMesh;

    const smoothstep = (min, max, value) => {
      const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
      return x * x * (3 - 2 * x);
    };

    // --- Phase 1: SAD (0.0s - 2.0s, loop back from 7.7s - 8.0s) ---
    let wSad = 0;
    if (t < 2.0) {
      wSad = (1.0 - smoothstep(1.5, 2.0, t)) * 0.85;
    } else if (t >= 7.6) {
      wSad = smoothstep(7.6, 8.0, t) * 0.85;
    }

    // --- Phase 2: HAPPY (2.0s - 4.0s) ---
    let wHappy = 0;
    if (t >= 1.9 && t < 4.1) {
      wHappy = smoothstep(1.9, 2.4, t) * (1.0 - smoothstep(3.6, 4.1, t));
    }

    // --- Phase 3: ANGRY & POUTING (4.0s - 6.0s) ---
    let wAngry = 0;
    if (t >= 3.9 && t < 6.1) {
      wAngry = smoothstep(3.9, 4.4, t) * (1.0 - smoothstep(5.6, 6.1, t));
    }

    // --- Phase 4: SPEECH "ah" and "eh" (6.0s - 8.0s) ---
    // Word 1: "ah" (peaks around 6.5s)
    let wAh = 0;
    if (t >= 6.1 && t <= 6.9) {
      wAh = Math.exp(-Math.pow(t - 6.5, 2) / (2 * Math.pow(0.16, 2)));
    }

    // Word 2: "eh" (peaks around 7.35s)
    let wEh = 0;
    if (t >= 7.0 && t <= 7.75) {
      wEh = Math.exp(-Math.pow(t - 7.35, 2) / (2 * Math.pow(0.16, 2)));
    }

    // Apply to VRM Expression Manager
    if (vrm.expressionManager) {
      vrm.expressionManager.setValue('sad', wSad);
      vrm.expressionManager.setValue('happy', 0); // Keep eyes open, smile driven via morphs
      vrm.expressionManager.setValue('relaxed', 0);
      vrm.expressionManager.setValue('angry', wAngry * 0.95);
      vrm.expressionManager.setValue('aa', wAh * 0.95);
      vrm.expressionManager.setValue('ee', wEh * 0.90);
    }

    // Direct morphs on Face mesh for nuanced facial acting (smiles, brows, pout)
    if (faceMesh && faceMesh.morphTargetDictionary && faceMesh.morphTargetInfluences) {
      const dict = faceMesh.morphTargetDictionary;
      const inf = faceMesh.morphTargetInfluences;

      // Happy smile & eyebrows
      if (dict['Fcl_MTH_Joy'] !== undefined) inf[dict['Fcl_MTH_Joy']] = wHappy * 0.95;
      if (dict['Fcl_BRW_Joy'] !== undefined) inf[dict['Fcl_BRW_Joy']] = wHappy * 0.85;

      // Sad brows & downturned mouth
      if (dict['Fcl_BRW_Sorrow'] !== undefined) inf[dict['Fcl_BRW_Sorrow']] = wSad * 0.90;
      if (dict['Fcl_MTH_Sorrow'] !== undefined) inf[dict['Fcl_MTH_Sorrow']] = wSad * 0.75;

      // Angry brows
      if (dict['Fcl_BRW_Angry'] !== undefined) inf[dict['Fcl_BRW_Angry']] = wAngry * 0.95;

      // Adorable Pouting mouth (Fcl_MTH_Small & Fcl_MTH_SkinFung)
      if (dict['Fcl_MTH_Small'] !== undefined) {
        inf[dict['Fcl_MTH_Small']] = wAngry * 0.88;
      }
      if (dict['Fcl_MTH_SkinFung'] !== undefined) {
        inf[dict['Fcl_MTH_SkinFung']] = wAngry * 0.45;
      }

      // Speech visemes directly on face mesh for crisp articulation
      if (dict['Fcl_MTH_A'] !== undefined && wAh > 0.05) {
        inf[dict['Fcl_MTH_A']] = wAh * 0.95;
      }
      if (dict['Fcl_MTH_E'] !== undefined && wEh > 0.05) {
        inf[dict['Fcl_MTH_E']] = wEh * 0.90;
      }
    }
  }
}
