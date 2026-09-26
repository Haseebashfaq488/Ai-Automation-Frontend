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
    // 1. Smooth emotional expressions
    this.expressions.update(delta);
    const emoOffsets = this.expressions.getBodyOffsets();

    // 2. Skeletal Motion: Either standard mocap VRMA animation or procedural idle/gestures
    if (this.animations.hasActiveAction()) {
      this.animations.update(delta);
    } else {
      // Procedural gestures and breathing
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
}
