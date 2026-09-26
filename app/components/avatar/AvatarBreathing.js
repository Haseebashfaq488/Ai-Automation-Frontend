import * as THREE from 'three';

/**
 * AvatarBreathing
 * Generates an organic, subtle breathing motion on the chest, spine, and subtle vertical hips offset.
 */
export class AvatarBreathing {
  constructor(vrm) {
    this.vrm = vrm;
    this.time = 0;

    // Breath frequency: ~14 breaths per minute (0.23 Hz -> period ~4.3s)
    this.breathSpeed = 1.4;

    // Get bone references
    this.chest = vrm.humanoid?.getNormalizedBoneNode('chest') ||
                 vrm.humanoid?.getNormalizedBoneNode('spine');
    this.upperChest = vrm.humanoid?.getNormalizedBoneNode('upperChest');
    this.spine = vrm.humanoid?.getNormalizedBoneNode('spine');
    this.hips = vrm.humanoid?.getNormalizedBoneNode('hips');

    // Store baseline bone rotations and positions
    this.baseHipsY = this.hips ? this.hips.position.y : 0;
    this.baseChestRot = this.chest ? this.chest.rotation.clone() : new THREE.Euler();
    this.baseUpperChestRot = this.upperChest ? this.upperChest.rotation.clone() : new THREE.Euler();
    this.baseSpineRot = this.spine ? this.spine.rotation.clone() : new THREE.Euler();
  }

  /**
   * Update breathing motion
   * @param {number} delta - Frame delta time in seconds
   * @param {object} emotionalOffsets - Offsets from active emotional state
   */
  update(delta, emotionalOffsets = {}) {
    this.time += delta * this.breathSpeed;

    const emoChestPitch = emotionalOffsets.chestPitch || 0;

    // Asymmetric breathing cycle: inhale slightly faster, exhale slower
    const breathCycle = Math.sin(this.time);
    const organicBreath = Math.sin(this.time) + 0.25 * Math.sin(2 * this.time + 0.5);

    // Subtle pitch rotation on chest/upperChest (breathing + emotion)
    const chestAngle = 0.012 * breathCycle + emoChestPitch;
    const spineAngle = 0.006 * breathCycle + emoChestPitch * 0.4;

    if (this.chest) {
      this.chest.rotation.x = this.baseChestRot.x + chestAngle;
    }
    if (this.upperChest) {
      this.upperChest.rotation.x = this.baseUpperChestRot.x + chestAngle * 0.7;
    }
    if (this.spine && this.spine !== this.chest) {
      this.spine.rotation.x = this.baseSpineRot.x + spineAngle;
    }

    // Micro vertical motion on hips/body (less than 2mm vertical displacement)
    if (this.hips) {
      this.hips.position.y = this.baseHipsY + 0.0018 * organicBreath;
    }
  }

  getBreathCycle() {
    return Math.sin(this.time);
  }
}
