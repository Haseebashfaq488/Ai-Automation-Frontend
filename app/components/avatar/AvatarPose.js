import * as THREE from 'three';

/**
 * AvatarPose
 * Sets a natural, human resting posture for the VRM avatar:
 * - Lowers arms from T/A-pose to rest naturally alongside the torso
 * - Softly relaxes elbows and wrists
 * - Adds organic finger curls so hands look natural instead of stiff flat paddles
 * - Aligns spine and chest into a relaxed, confident posture
 */
export class AvatarPose {
  constructor(vrm) {
    this.vrm = vrm;
    this.humanoid = vrm.humanoid;
    this.applyNaturalPose();
  }

  getBone(name) {
    return this.humanoid?.getNormalizedBoneNode(name);
  }

  applyNaturalPose() {
    if (!this.humanoid) return;

    // 1. Spine & Chest natural upright curvature
    const spine = this.getBone('spine');
    const chest = this.getBone('chest');
    const neck = this.getBone('neck');

    if (spine) {
      spine.rotation.x = 0.02; // very slight natural forward curve
    }
    if (chest) {
      chest.rotation.x = -0.01; // slight chest opening
    }
    if (neck) {
      neck.rotation.x = 0.02; // natural neck alignment
    }

    // 2. Arms natural resting position (lowered ~68° from T-pose, slightly forward)
    const leftUpperArm = this.getBone('leftUpperArm');
    const rightUpperArm = this.getBone('rightUpperArm');

    if (leftUpperArm) {
      leftUpperArm.rotation.set(
        THREE.MathUtils.degToRad(8),    // slight forward
        THREE.MathUtils.degToRad(0),
        THREE.MathUtils.degToRad(-68)   // arms down along sides
      );
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.set(
        THREE.MathUtils.degToRad(8),    // slight forward
        THREE.MathUtils.degToRad(0),
        THREE.MathUtils.degToRad(68)    // arms down along sides
      );
    }

    // 3. Forearms / Elbows (slight natural inward bend)
    const leftLowerArm = this.getBone('leftLowerArm');
    const rightLowerArm = this.getBone('rightLowerArm');

    if (leftLowerArm) {
      leftLowerArm.rotation.set(
        THREE.MathUtils.degToRad(5),
        THREE.MathUtils.degToRad(-15),
        THREE.MathUtils.degToRad(-12)
      );
    }
    if (rightLowerArm) {
      rightLowerArm.rotation.set(
        THREE.MathUtils.degToRad(5),
        THREE.MathUtils.degToRad(15),
        THREE.MathUtils.degToRad(12)
      );
    }

    // 4. Wrists / Hands (relaxed inward orientation)
    const leftHand = this.getBone('leftHand');
    const rightHand = this.getBone('rightHand');

    if (leftHand) {
      leftHand.rotation.set(0, 0, THREE.MathUtils.degToRad(-5));
    }
    if (rightHand) {
      rightHand.rotation.set(0, 0, THREE.MathUtils.degToRad(5));
    }

    // 5. Natural Finger Curls (relaxed resting hand)
    this.curlFingers('left', 1);
    this.curlFingers('right', -1);
  }

  curlFingers(side, direction) {
    const fingerTypes = ['Index', 'Middle', 'Ring', 'Little'];

    // Thumb: slight natural opposition
    const thumbProximal = this.getBone(`${side}ThumbProximal`);
    const thumbDistal = this.getBone(`${side}ThumbDistal`);
    if (thumbProximal) {
      thumbProximal.rotation.set(
        THREE.MathUtils.degToRad(10),
        THREE.MathUtils.degToRad(direction * 15),
        THREE.MathUtils.degToRad(direction * 10)
      );
    }
    if (thumbDistal) {
      thumbDistal.rotation.z = THREE.MathUtils.degToRad(direction * 15);
    }

    // Main 4 fingers: gradual natural curling inward
    fingerTypes.forEach((finger, index) => {
      // Slightly more curl from index to pinky
      const baseCurl = 15 + index * 4;

      const proximal = this.getBone(`${side}${finger}Proximal`);
      const intermediate = this.getBone(`${side}${finger}Intermediate`);
      const distal = this.getBone(`${side}${finger}Distal`);

      if (proximal) {
        proximal.rotation.z = THREE.MathUtils.degToRad(direction * baseCurl);
      }
      if (intermediate) {
        intermediate.rotation.z = THREE.MathUtils.degToRad(direction * (baseCurl * 0.8));
      }
      if (distal) {
        distal.rotation.z = THREE.MathUtils.degToRad(direction * (baseCurl * 0.5));
      }
    });
  }
}
