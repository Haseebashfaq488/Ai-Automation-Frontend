import * as THREE from 'three';

/**
 * AvatarGestures
 * Handles expressive hand and arm gestures for each emotional state:
 * - Happy 1 (Clap): Hands meet at chest area in an applause/clapping motion with head tilted left.
 * - Happy 2 (Wave): Friendly, cheerful waving hand near shoulder height.
 * - Happy 3 (Heartfelt): Right hand placed gently over heart/chest in gratitude.
 * - Surprised: Startled defensive hands up to mid-chest.
 * - Sad: Slumped, drooping arms and limp wrists.
 * - Angry: Tense posture with semi-clenched fists.
 * - Relaxed: Loosely draped arms.
 * - Neutral: Balanced resting posture.
 */
export class AvatarGestures {
  constructor(vrm) {
    this.vrm = vrm;
    this.humanoid = vrm.humanoid;
    this.time = 0;
    this.activeEmotion = 'neutral';

    // Bone references
    this.leftUpperArm = this.getBone('leftUpperArm');
    this.rightUpperArm = this.getBone('rightUpperArm');
    this.leftLowerArm = this.getBone('leftLowerArm');
    this.rightLowerArm = this.getBone('rightLowerArm');
    this.leftHand = this.getBone('leftHand');
    this.rightHand = this.getBone('rightHand');

    // Cache finger bones
    this.leftFingers = this.cacheFingers('left');
    this.rightFingers = this.cacheFingers('right');

    // Gesture Presets
    this.presets = {
      neutral: {
        lUpperArm: [8, 0, -68],
        rUpperArm: [8, 0, 68],
        lLowerArm: [5, -15, -12],
        rLowerArm: [5, 15, 12],
        lHand: [0, 0, -5],
        rHand: [0, 0, 5],
        fingerCurl: 1.0 // standard resting curl
      },
      // Happy 1: Clap in chest area
      happy_clap: {
        lUpperArm: [36, -14, -36],
        rUpperArm: [36, 14, 36],
        lLowerArm: [66, -46, -18],
        rLowerArm: [66, 46, 18],
        lHand: [12, -26, 6],
        rHand: [12, 26, -6],
        fingerCurl: 0.45 // flat/open hands meeting in a clap
      },
      // Happy 2: Cheerful friendly wave
      happy_wave: {
        lUpperArm: [8, 0, -68],
        rUpperArm: [46, -12, 36],
        lLowerArm: [8, -12, -10],
        rLowerArm: [74, 18, 16],
        lHand: [0, 0, -5],
        rHand: [-10, 22, -10],
        fingerCurl: 0.4 // open waving fingers
      },
      // Happy 3: Heartfelt hand over chest
      happy_heart: {
        lUpperArm: [8, 0, -68],
        rUpperArm: [36, -20, 36],
        lLowerArm: [8, -12, -10],
        rLowerArm: [78, 30, 22],
        lHand: [0, 0, -5],
        rHand: [-12, 16, -14],
        fingerCurl: 0.65 // gentle palm over heart
      },
      surprised: {
        // Startled defensive reaction: hands raise up to mid-chest
        lUpperArm: [38, 8, -50],
        rUpperArm: [38, -8, 50],
        lLowerArm: [55, -28, -20],
        rLowerArm: [55, 28, 20],
        lHand: [-18, -5, 10],
        rHand: [-18, 5, -10],
        fingerCurl: 0.3 // fingers spread in surprise
      },
      sad: {
        // Defeated, drooping arms and limp hands
        lUpperArm: [2, 8, -72],
        rUpperArm: [2, -8, 72],
        lLowerArm: [14, -8, -6],
        rLowerArm: [14, 8, 6],
        lHand: [-12, 0, -8],
        rHand: [-12, 0, 8],
        fingerCurl: 1.25 // limp, curled in
      },
      angry: {
        // Tense posture: elbows back, fists semi-clenched with aggression
        lUpperArm: [-8, -6, -58],
        rUpperArm: [-8, 6, 58],
        lLowerArm: [30, -18, -15],
        rLowerArm: [30, 18, 15],
        lHand: [15, 0, -10],
        rHand: [15, 0, 10],
        fingerCurl: 1.85 // clenched fists
      },
      relaxed: {
        // Loose, easy posture
        lUpperArm: [5, 0, -70],
        rUpperArm: [5, 0, 70],
        lLowerArm: [8, -12, -10],
        rLowerArm: [8, 12, 10],
        lHand: [2, 0, -5],
        rHand: [2, 0, 5],
        fingerCurl: 0.85
      }
    };

    // Alias 'happy' to 'happy_clap' by default
    this.presets.happy = this.presets.happy_clap;

    // Current interpolated state
    this.current = this.clonePreset(this.presets.neutral);
    this.target = this.presets.neutral;
  }

  getBone(name) {
    return this.humanoid?.getNormalizedBoneNode(name);
  }

  clonePreset(preset) {
    return {
      lUpperArm: [...preset.lUpperArm],
      rUpperArm: [...preset.rUpperArm],
      lLowerArm: [...preset.lLowerArm],
      rLowerArm: [...preset.rLowerArm],
      lHand: [...preset.lHand],
      rHand: [...preset.rHand],
      fingerCurl: preset.fingerCurl
    };
  }

  cacheFingers(side) {
    const list = [];
    const fingerTypes = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
    const segments = ['Proximal', 'Intermediate', 'Distal'];

    fingerTypes.forEach((f) => {
      segments.forEach((seg) => {
        const bone = this.getBone(`${side}${f}${seg}`);
        if (bone) {
          list.push({ bone, type: f, seg, side });
        }
      });
    });
    return list;
  }

  /**
   * Set target emotional gesture
   * @param {string} emotion 
   */
  setEmotion(emotion) {
    this.activeEmotion = emotion;
    this.target = this.presets[emotion] || this.presets.neutral;
  }

  /**
   * Update hand and arm movements smoothly every frame
   * @param {number} delta - Frame delta time in seconds
   * @param {number} breathCycle - Current breathing wave value (-1 to 1)
   */
  update(delta, breathCycle = 0) {
    this.time += delta;
    const factor = 1.0 - Math.exp(-5.5 * delta); // smooth organic transition

    // 1. Interpolate arm & hand rotation angles (degrees)
    const lerpArray = (curr, tgt) => {
      for (let i = 0; i < curr.length; i++) {
        curr[i] += (tgt[i] - curr[i]) * factor;
      }
    };

    lerpArray(this.current.lUpperArm, this.target.lUpperArm);
    lerpArray(this.current.rUpperArm, this.target.rUpperArm);
    lerpArray(this.current.lLowerArm, this.target.lLowerArm);
    lerpArray(this.current.rLowerArm, this.target.rLowerArm);
    lerpArray(this.current.lHand, this.target.lHand);
    lerpArray(this.current.rHand, this.target.rHand);
    this.current.fingerCurl += (this.target.fingerCurl - this.current.fingerCurl) * factor;

    // 2. Continuous Living Micro-Motion (Breathing sway + organic finger flexing)
    const armSway = 0.8 * breathCycle;
    const fingerMicroSway = 0.04 * Math.sin(this.time * 1.8);

    // 3. Dynamic Emotional Micro-Motions (Clapping rhythm or waving motion)
    let clapOffset = 0;
    let waveOffset = 0;

    if (this.activeEmotion === 'happy_clap' || this.activeEmotion === 'happy') {
      // Gentle clapping rhythm at ~2.5 claps per second
      const clapCycle = Math.sin(this.time * 6.5);
      clapOffset = Math.max(0, clapCycle) * 3.8;
    } else if (this.activeEmotion === 'happy_wave') {
      // Fluid waving motion back and forth
      waveOffset = Math.sin(this.time * 6.0) * 12.0;
    }

    // 4. Apply Rotations to Upper Arms
    if (this.leftUpperArm) {
      this.leftUpperArm.rotation.set(
        THREE.MathUtils.degToRad(this.current.lUpperArm[0] + armSway),
        THREE.MathUtils.degToRad(this.current.lUpperArm[1]),
        THREE.MathUtils.degToRad(this.current.lUpperArm[2] - clapOffset)
      );
    }
    if (this.rightUpperArm) {
      this.rightUpperArm.rotation.set(
        THREE.MathUtils.degToRad(this.current.rUpperArm[0] + armSway),
        THREE.MathUtils.degToRad(this.current.rUpperArm[1]),
        THREE.MathUtils.degToRad(this.current.rUpperArm[2] + clapOffset)
      );
    }

    // 5. Apply Rotations to Lower Arms
    if (this.leftLowerArm) {
      this.leftLowerArm.rotation.set(
        THREE.MathUtils.degToRad(this.current.lLowerArm[0]),
        THREE.MathUtils.degToRad(this.current.lLowerArm[1] + clapOffset),
        THREE.MathUtils.degToRad(this.current.lLowerArm[2])
      );
    }
    if (this.rightLowerArm) {
      this.rightLowerArm.rotation.set(
        THREE.MathUtils.degToRad(this.current.rLowerArm[0]),
        THREE.MathUtils.degToRad(this.current.rLowerArm[1] - clapOffset + waveOffset * 0.4),
        THREE.MathUtils.degToRad(this.current.rLowerArm[2])
      );
    }

    // 6. Apply Rotations to Wrists / Hands
    if (this.leftHand) {
      this.leftHand.rotation.set(
        THREE.MathUtils.degToRad(this.current.lHand[0]),
        THREE.MathUtils.degToRad(this.current.lHand[1]),
        THREE.MathUtils.degToRad(this.current.lHand[2])
      );
    }
    if (this.rightHand) {
      this.rightHand.rotation.set(
        THREE.MathUtils.degToRad(this.current.rHand[0]),
        THREE.MathUtils.degToRad(this.current.rHand[1] + waveOffset * 0.6),
        THREE.MathUtils.degToRad(this.current.rHand[2] + waveOffset * 0.5)
      );
    }

    // 7. Apply Dynamic Finger Curls
    const effectiveCurl = Math.max(0.1, this.current.fingerCurl + fingerMicroSway);
    this.applyFingerCurls(this.leftFingers, 1, effectiveCurl);
    this.applyFingerCurls(this.rightFingers, -1, effectiveCurl);
  }

  applyFingerCurls(fingerList, direction, curlMultiplier) {
    fingerList.forEach(({ bone, type, seg }) => {
      if (type === 'Thumb') {
        const angle = THREE.MathUtils.degToRad(direction * 14 * curlMultiplier);
        bone.rotation.z = angle;
      } else {
        let baseAngle = 16;
        if (seg === 'Intermediate') baseAngle = 18;
        if (seg === 'Distal') baseAngle = 10;

        const rad = THREE.MathUtils.degToRad(direction * baseAngle * curlMultiplier);
        bone.rotation.z = rad;
      }
    });
  }
}
