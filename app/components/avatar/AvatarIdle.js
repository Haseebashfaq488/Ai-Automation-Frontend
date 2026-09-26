import * as THREE from 'three';

/**
 * AvatarIdle
 * Procedural multi-harmonic micro-motion for head, neck, spine, and shoulders.
 * Uses non-repeating irrational frequencies to ensure movements feel calm, organic, and never mechanical.
 */
export class AvatarIdle {
  constructor(vrm) {
    this.vrm = vrm;
    this.time = 0;

    const humanoid = vrm.humanoid;
    this.head = humanoid?.getNormalizedBoneNode('head');
    this.neck = humanoid?.getNormalizedBoneNode('neck');
    this.spine = humanoid?.getNormalizedBoneNode('spine');
    this.leftShoulder = humanoid?.getNormalizedBoneNode('leftShoulder');
    this.rightShoulder = humanoid?.getNormalizedBoneNode('rightShoulder');

    // Store base rotations to avoid drift
    this.baseHeadRot = this.head ? this.head.rotation.clone() : new THREE.Euler();
    this.baseNeckRot = this.neck ? this.neck.rotation.clone() : new THREE.Euler();
    this.baseSpineRot = this.spine ? this.spine.rotation.clone() : new THREE.Euler();
    this.baseLeftShoulderRot = this.leftShoulder ? this.leftShoulder.rotation.clone() : new THREE.Euler();
    this.baseRightShoulderRot = this.rightShoulder ? this.rightShoulder.rotation.clone() : new THREE.Euler();
  }

  /**
   * Update idle motion with layered emotional body language
   * @param {number} delta - Frame delta time in seconds
   * @param {object} emotionalOffsets - Offsets from active emotional state
   */
  update(delta, emotionalOffsets = {}) {
    this.time += delta;
    const t = this.time;

    const emoHeadPitch = emotionalOffsets.headPitch || 0;
    const emoHeadYaw = emotionalOffsets.headYaw || 0;
    const emoHeadRoll = emotionalOffsets.headRoll || 0;
    const emoShoulder = emotionalOffsets.shoulderLift || 0;

    // Multi-frequency harmonic synthesis + emotional posture
    const headYaw = 0.018 * Math.sin(t * 0.37) + 0.008 * Math.sin(t * 0.73 + 1.2) + emoHeadYaw;
    const headPitch = 0.012 * Math.sin(t * 0.43 + 0.8) + 0.006 * Math.cos(t * 0.89) + emoHeadPitch;
    const headRoll = 0.009 * Math.sin(t * 0.29 + 2.1) + emoHeadRoll;

    // Apply head and neck rotations (split: neck ~35%, head ~65%)
    if (this.head) {
      this.head.rotation.x = this.baseHeadRot.x + headPitch * 0.65;
      this.head.rotation.y = this.baseHeadRot.y + headYaw * 0.65;
      this.head.rotation.z = this.baseHeadRot.z + headRoll * 0.65;
    }

    if (this.neck) {
      this.neck.rotation.x = this.baseNeckRot.x + headPitch * 0.35;
      this.neck.rotation.y = this.baseNeckRot.y + headYaw * 0.35;
      this.neck.rotation.z = this.baseNeckRot.z + headRoll * 0.35;
    }

    // Spine subtle sway / weight shift
    if (this.spine) {
      const spineYaw = 0.006 * Math.sin(t * 0.23);
      const spineRoll = 0.005 * Math.sin(t * 0.19 + 1.0);
      this.spine.rotation.y = this.baseSpineRot.y + spineYaw;
      this.spine.rotation.z = this.baseSpineRot.z + spineRoll;
    }

    // Micro shoulder adjustment accompanying sway + emotional response
    if (this.leftShoulder) {
      const shoulderDelta = 0.003 * Math.sin(t * 0.25) + emoShoulder;
      this.leftShoulder.rotation.z = this.baseLeftShoulderRot.z + shoulderDelta;
    }
    if (this.rightShoulder) {
      const shoulderDelta = 0.003 * Math.sin(t * 0.25) + emoShoulder;
      this.rightShoulder.rotation.z = this.baseRightShoulderRot.z - shoulderDelta;
    }
  }
}
