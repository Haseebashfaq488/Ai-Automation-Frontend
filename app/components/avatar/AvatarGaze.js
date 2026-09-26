import * as THREE from 'three';

/**
 * AvatarGaze
 * Manages avatar gaze towards the viewer/camera with natural micro-saccades and subtle variation.
 */
export class AvatarGaze {
  constructor(vrm, camera) {
    this.vrm = vrm;
    this.camera = camera;
    this.lookAt = vrm.lookAt;

    // Create a target object that VRM LookAt can track
    this.targetObj = new THREE.Object3D();
    if (this.vrm.scene.parent) {
      this.vrm.scene.parent.add(this.targetObj);
    }

    if (this.lookAt) {
      this.lookAt.target = this.targetObj;
    }

    // Micro-saccade state
    this.timer = this.getRandomInterval();
    this.currentOffset = new THREE.Vector3();
    this.targetOffset = new THREE.Vector3();

    this.saccadeHoldTimer = 0;
    this.isShifted = false;
  }

  getRandomInterval() {
    // 2.0 to 4.5 seconds between subtle micro-saccades
    return 2.0 + Math.random() * 2.5;
  }

  /**
   * Update gaze target
   * @param {number} delta - Frame delta in seconds
   */
  update(delta) {
    if (!this.lookAt || !this.camera) return;

    // Handle micro-saccades
    this.timer -= delta;
    if (this.timer <= 0) {
      if (!this.isShifted) {
        // Shift gaze slightly away from dead center (micro-glance)
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.03 + Math.random() * 0.05; // 3cm - 8cm offset in 3D space
        this.targetOffset.set(
          Math.cos(angle) * radius,
          Math.sin(angle) * (radius * 0.5), // less vertical shift
          0
        );
        this.isShifted = true;
        this.timer = 0.7 + Math.random() * 0.8; // hold for 0.7 - 1.5 seconds
      } else {
        // Return gaze directly back to viewer
        this.targetOffset.set(0, 0, 0);
        this.isShifted = false;
        this.timer = this.getRandomInterval();
      }
    }

    // Smoothly interpolate current offset towards target offset (smooth saccade)
    this.currentOffset.lerp(this.targetOffset, 1.0 - Math.exp(-8.0 * delta));

    // Base position is camera position
    const camPos = this.camera.position;
    this.targetObj.position.copy(camPos).add(this.currentOffset);
    this.targetObj.updateMatrixWorld();

    // Directly direct lookAt towards target
    if (typeof this.lookAt.lookAt === 'function') {
      this.lookAt.lookAt(this.targetObj.position);
    }
  }
}
