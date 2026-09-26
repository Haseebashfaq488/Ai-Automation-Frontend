import * as THREE from 'three';

/**
 * AvatarExpression
 * Master facial emotion and conversational expression engine.
 * 
 * CRITICAL DESIGN:
 * In standard VRoid models, the 'happy' and 'relaxed' presets bind to 'Fcl_ALL_Joy'
 * and 'Fcl_ALL_Fun', which forcibly close the eyes into squinted crescents (^_^).
 * 
 * To ensure the avatar has radiant, wide-open, alive eyes that look at the user:
 * 1. We decouple mouth smiles and happy eyebrows (Fcl_MTH_Joy, Fcl_MTH_Fun, Fcl_BRW_Joy, Fcl_BRW_Fun)
 *    directly on the Face mesh so she smiles brightly with WIDE-OPEN EYES!
 * 2. Eyelids stay fully open except for intentional single-eye winks (peace_sign, blowing_kiss)
 *    or natural 150ms procedural blinks.
 */
export class AvatarExpression {
  constructor(vrm) {
    this.vrm = vrm;
    this.expressionManager = vrm.expressionManager;
    this.humanoid = vrm.humanoid;

    // Bone references for emotional body language
    this.head = this.humanoid?.getNormalizedBoneNode('head');
    this.neck = this.humanoid?.getNormalizedBoneNode('neck');
    this.chest = this.humanoid?.getNormalizedBoneNode('chest');
    this.leftShoulder = this.humanoid?.getNormalizedBoneNode('leftShoulder');
    this.rightShoulder = this.humanoid?.getNormalizedBoneNode('rightShoulder');

    this.activeEmotion = 'neutral';

    // Find the Face mesh to control smile mouth and eyebrows independently of eyes
    this.faceMesh = null;
    this.morphIndices = {};

    this.vrm.scene.traverse((obj) => {
      if (obj.isMesh && obj.morphTargetDictionary && obj.morphTargetDictionary['Fcl_MTH_Joy'] !== undefined) {
        this.faceMesh = obj;
        this.morphIndices = {
          mthJoy: obj.morphTargetDictionary['Fcl_MTH_Joy'], // Smile mouth (eyes open!)
          mthFun: obj.morphTargetDictionary['Fcl_MTH_Fun'], // Cheerful mouth (eyes open!)
          brwJoy: obj.morphTargetDictionary['Fcl_BRW_Joy'], // Happy brows
          brwFun: obj.morphTargetDictionary['Fcl_BRW_Fun'], // Friendly brows
        };
      }
    });

    // Independent smile weights (EYES STAY WIDE OPEN)
    this.currentSmileJoy = 0;
    this.targetSmileJoy = 0;
    this.currentSmileFun = 0;
    this.targetSmileFun = 0;

    // Standard VRM blendshapes we safely manage
    this.managedExpressions = [
      'surprised',
      'sad',
      'angry',
      'neutral',
      'aa',
      'ih',
      'ou',
      'ee',
      'oh',
      'blink',
      'blinkLeft',
      'blinkRight'
    ];

    this.currentWeights = {};
    this.targetWeights = {};
    for (const name of this.managedExpressions) {
      this.currentWeights[name] = 0;
      this.targetWeights[name] = 0;
    }

    // Emotional Body Posture Offsets
    this.currentBodyOffsets = { headPitch: 0, headYaw: 0, headRoll: 0, chestPitch: 0, shoulderLift: 0 };
    this.targetBodyOffsets = { headPitch: 0, headYaw: 0, headRoll: 0, chestPitch: 0, shoulderLift: 0 };

    // Handcrafted Open-Eyed Facial Recipes for EVERY Movement
    this.facialProfiles = {
      // ==========================================
      // 1. CUTE, AFFECTION & SHYNESS (Eyes Open & Sparkling!)
      // ==========================================
      shy: {
        // Bashful sweet smile, wide open eyes with subtle shy tilt
        smile: { joy: 0.6, fun: 0.2 },
        weights: { ou: 0.1 },
        posture: { headPitch: 0.03, headYaw: 0.02, headRoll: -0.065, chestPitch: 0.01, shoulderLift: 0.03 }
      },
      heart_hands: {
        // Adoring, heartfelt open smile locked onto user
        smile: { joy: 0.85, fun: 0.25 },
        weights: { ee: 0.15 },
        posture: { headPitch: 0.02, headYaw: 0.01, headRoll: 0.045, chestPitch: -0.045, shoulderLift: 0.02 }
      },
      peace_sign: {
        // Cheerful anime wink on LEFT eye, RIGHT eye wide open!
        smile: { joy: 0.95 },
        weights: { blinkLeft: 0.95, ee: 0.25 },
        posture: { headPitch: -0.04, headYaw: -0.02, headRoll: -0.07, chestPitch: -0.03, shoulderLift: 0.03 }
      },
      cute_pose: {
        // Radiant photo-ready smile with wide open eyes
        smile: { joy: 0.95, fun: 0.2 },
        weights: { ih: 0.15 },
        posture: { headPitch: -0.03, headYaw: 0.02, headRoll: 0.06, chestPitch: -0.035, shoulderLift: 0.03 }
      },
      cat_pose: {
        // Playful cat paws with cute anime cat mouth ('3' shape), eyes wide open!
        smile: { fun: 0.5 },
        weights: { ou: 0.38, ih: 0.12 },
        posture: { headPitch: -0.02, headYaw: -0.02, headRoll: -0.05, chestPitch: -0.02, shoulderLift: 0.035 }
      },
      blowing_kiss: {
        // Romantic kiss lips with charming wink on left eye!
        smile: { joy: 0.3 },
        weights: { ou: 0.88, blinkLeft: 0.85, ih: 0.12 },
        posture: { headPitch: -0.02, headYaw: 0.01, headRoll: 0.03, chestPitch: -0.03, shoulderLift: 0.015 }
      },
      blush: {
        // Bashful flustered sweet smile with wide curious eyes
        smile: { joy: 0.5, fun: 0.35 },
        weights: { ih: 0.15 },
        posture: { headPitch: 0.04, headYaw: 0.03, headRoll: -0.05, chestPitch: 0.02, shoulderLift: 0.035 }
      },
      cute_idle: {
        // Gentle resting charm, fully open eyes
        smile: { joy: 0.35, fun: 0.3 },
        weights: {},
        posture: { headPitch: -0.02, headYaw: -0.01, headRoll: 0.03, chestPitch: -0.02, shoulderLift: 0.01 }
      },
      show_off_ring: {
        // Proud, sassy smirk with charming wink and confident tilt
        smile: { joy: 0.85, fun: 0.25 },
        weights: { blinkRight: 0.75, ee: 0.15 },
        posture: { headPitch: -0.04, headYaw: -0.03, headRoll: 0.05, chestPitch: -0.03, shoulderLift: 0.035 }
      },

      // ==========================================
      // 2. GREETINGS & RESPECT (Eyes Open & Welcoming)
      // ==========================================
      greeting: {
        // Hospitable Japanese assistant welcome smile
        smile: { joy: 0.78, fun: 0.2 },
        weights: { ee: 0.12 },
        posture: { headPitch: -0.03, headYaw: 0.02, headRoll: 0.045, chestPitch: -0.035, shoulderLift: 0.02 }
      },
      waving: {
        // Casual friendly wave, open eyes
        smile: { joy: 0.85 },
        weights: { ee: 0.1 },
        posture: { headPitch: -0.03, headYaw: 0.03, headRoll: 0.055, chestPitch: -0.035, shoulderLift: 0.025 }
      },
      standing_greeting: {
        // Elegant poised assistant welcome
        smile: { joy: 0.55, fun: 0.35 },
        weights: {},
        posture: { headPitch: -0.02, headYaw: 0, headRoll: 0.02, chestPitch: -0.03, shoulderLift: 0.01 }
      },
      salute_greeting: {
        // Alert, crisp attention with bright open eyes
        smile: { joy: 0.65 },
        weights: { surprised: 0.15, ee: 0.12 },
        posture: { headPitch: -0.03, headYaw: 0, headRoll: -0.02, chestPitch: -0.045, shoulderLift: 0.03 }
      },
      bow: {
        // Respectful nod-bow with intentional closed eyes
        smile: { fun: 0.4 },
        weights: { blink: 0.85 },
        posture: { headPitch: 0.08, headYaw: 0, headRoll: 0, chestPitch: 0.05, shoulderLift: -0.01 }
      },
      formal_bow: {
        // Deep formal bow with intentional closed eyes
        smile: { fun: 0.3 },
        weights: { blink: 0.95 },
        posture: { headPitch: 0.12, headYaw: 0, headRoll: 0, chestPitch: 0.08, shoulderLift: -0.015 }
      },
      thankful: {
        // Heartfelt appreciation with warm open eyes
        smile: { joy: 0.7, fun: 0.3 },
        weights: { ee: 0.1 },
        posture: { headPitch: 0.03, headYaw: 0.01, headRoll: 0.035, chestPitch: -0.04, shoulderLift: 0.015 }
      },

      // ==========================================
      // 3. ASSISTANT WORK & DIALOGUE (Eyes Focused & Open)
      // ==========================================
      talking: {
        // Friendly conversational baseline
        smile: { joy: 0.4, fun: 0.2 },
        weights: {},
        posture: { headPitch: -0.02, headYaw: 0.01, headRoll: 0.02, chestPitch: -0.02, shoulderLift: 0.01 }
      },
      presenting: {
        // Helpful open-eyed guide
        smile: { joy: 0.75, fun: 0.25 },
        weights: { ee: 0.15 },
        posture: { headPitch: -0.03, headYaw: -0.02, headRoll: -0.03, chestPitch: -0.04, shoulderLift: 0.02 }
      },
      nodding: {
        // Attentive understanding, eyes wide and focused on user
        smile: { joy: 0.4, fun: 0.45 },
        weights: {},
        posture: { headPitch: -0.01, headYaw: 0, headRoll: 0.015, chestPitch: -0.02, shoulderLift: 0.005 }
      },
      shake_no: {
        // Polite gentle refusal
        smile: {},
        weights: { sad: 0.3, ou: 0.15 },
        posture: { headPitch: 0.03, headYaw: 0.02, headRoll: -0.03, chestPitch: 0.01, shoulderLift: -0.01 }
      },
      task_received: {
        // Ready for action
        smile: { joy: 0.65 },
        weights: { surprised: 0.15, ee: 0.12 },
        posture: { headPitch: -0.03, headYaw: 0, headRoll: -0.01, chestPitch: -0.04, shoulderLift: 0.025 }
      },
      pointing_thinking: {
        // "Aha!" lightbulb moment with wide bright eyes
        smile: { joy: 0.55 },
        weights: { surprised: 0.4, oh: 0.2 },
        posture: { headPitch: -0.05, headYaw: 0.02, headRoll: 0.04, chestPitch: -0.035, shoulderLift: 0.03 }
      },
      check_time: {
        // Curious open-eyed glance
        smile: {},
        weights: { surprised: 0.3 },
        posture: { headPitch: 0.05, headYaw: -0.03, headRoll: -0.02, chestPitch: 0.01, shoulderLift: 0.01 }
      },
      shrugging: {
        // Quizzical shrug with raised brows and open eyes
        smile: { fun: 0.35 },
        weights: { surprised: 0.45, ih: 0.18 },
        posture: { headPitch: -0.04, headYaw: 0.02, headRoll: 0.05, chestPitch: -0.01, shoulderLift: 0.05 }
      },
      thinking: {
        // Thoughtful face, eyes open and looking up/side
        smile: {},
        weights: { ou: 0.22 },
        posture: { headPitch: 0.02, headYaw: -0.02, headRoll: 0.035, chestPitch: -0.01, shoulderLift: 0.01 }
      },

      // ==========================================
      // 4. JOY & PRAISE (Eyes Radiant & Alive)
      // ==========================================
      cheering: {
        // Ecstatic celebration, mouth open wide with excitement
        smile: { joy: 1.0 },
        weights: { aa: 0.5, ee: 0.35 },
        posture: { headPitch: -0.06, headYaw: 0, headRoll: -0.04, chestPitch: -0.055, shoulderLift: 0.04 }
      },
      clapping: {
        // Congratulatory open smile
        smile: { joy: 0.92, fun: 0.2 },
        weights: { ee: 0.2 },
        posture: { headPitch: -0.04, headYaw: -0.02, headRoll: -0.065, chestPitch: -0.045, shoulderLift: 0.035 }
      },
      joyful_jump: {
        // Joyful jump with wide open smile
        smile: { joy: 1.0 },
        weights: { aa: 0.48, ee: 0.3 },
        posture: { headPitch: -0.06, headYaw: 0, headRoll: 0.02, chestPitch: -0.05, shoulderLift: 0.04 }
      },
      happy_gesture: {
        smile: { joy: 0.88 },
        weights: { ee: 0.2 },
        posture: { headPitch: -0.03, headYaw: 0.02, headRoll: 0.05, chestPitch: -0.035, shoulderLift: 0.025 }
      },
      happy_idle: {
        smile: { joy: 0.55, fun: 0.3 },
        weights: {},
        posture: { headPitch: -0.03, headYaw: -0.01, headRoll: -0.03, chestPitch: -0.03, shoulderLift: 0.02 }
      },
      encouraging: {
        smile: { joy: 0.92 },
        weights: { ee: 0.28 },
        posture: { headPitch: -0.04, headYaw: 0, headRoll: -0.02, chestPitch: -0.045, shoulderLift: 0.03 }
      },

      // ==========================================
      // 5. RELAX & CASUAL POSTURES (Eyes Open & Tranquil)
      // ==========================================
      relax: {
        smile: { fun: 0.6, joy: 0.25 },
        weights: {},
        posture: { headPitch: -0.02, headYaw: -0.01, headRoll: 0.04, chestPitch: -0.02, shoulderLift: -0.025 }
      },
      look_around: {
        smile: {},
        weights: {},
        posture: { headPitch: 0, headYaw: 0, headRoll: 0, chestPitch: 0, shoulderLift: 0 }
      },
      relieved: {
        smile: { joy: 0.3, fun: 0.4 },
        weights: { oh: 0.25 },
        posture: { headPitch: 0.03, headYaw: 0.01, headRoll: 0.03, chestPitch: 0.02, shoulderLift: -0.03 }
      },
      curious_leaning: {
        smile: { joy: 0.45 },
        weights: { surprised: 0.22 },
        posture: { headPitch: 0.04, headYaw: 0.01, headRoll: -0.03, chestPitch: 0.03, shoulderLift: 0.015 }
      },
      hands_on_hips: {
        smile: { joy: 0.75, fun: 0.25 },
        weights: {},
        posture: { headPitch: -0.03, headYaw: 0, headRoll: -0.025, chestPitch: -0.04, shoulderLift: 0.02 }
      },
      neck_stretch: {
        smile: { fun: 0.5 },
        weights: {},
        posture: { headPitch: -0.04, headYaw: 0.02, headRoll: 0.06, chestPitch: -0.03, shoulderLift: 0.01 }
      },
      model_pose: {
        smile: { joy: 0.65, fun: 0.3 },
        weights: {},
        posture: { headPitch: -0.03, headYaw: -0.02, headRoll: 0.05, chestPitch: -0.035, shoulderLift: 0.02 }
      },
      sleepy: {
        smile: { fun: 0.3 },
        weights: { blink: 0.45 }, // intentional heavy eyelids only on sleepy
        posture: { headPitch: 0.06, headYaw: 0.01, headRoll: -0.03, chestPitch: 0.03, shoulderLift: -0.02 }
      },

      // ==========================================
      // 6. STANDARD EMOTIONS
      // ==========================================
      neutral: {
        smile: {},
        weights: {},
        posture: { headPitch: 0, headYaw: 0, headRoll: 0, chestPitch: 0, shoulderLift: 0 }
      },
      happy_clap: {
        smile: { joy: 0.95 },
        weights: { ee: 0.2 },
        posture: { headPitch: -0.04, headYaw: -0.02, headRoll: -0.065, chestPitch: -0.045, shoulderLift: 0.035 }
      },
      happy_wave: {
        smile: { joy: 0.9 },
        weights: { ee: 0.15 },
        posture: { headPitch: -0.03, headYaw: 0.03, headRoll: 0.05, chestPitch: -0.035, shoulderLift: 0.025 }
      },
      happy_heart: {
        smile: { joy: 0.85, fun: 0.25 },
        weights: { ee: 0.15 },
        posture: { headPitch: 0.03, headYaw: 0.01, headRoll: 0.04, chestPitch: -0.05, shoulderLift: 0.02 }
      },
      relaxed: {
        smile: { fun: 0.65, joy: 0.2 },
        weights: {},
        posture: { headPitch: -0.02, headYaw: -0.01, headRoll: 0.035, chestPitch: -0.02, shoulderLift: -0.025 }
      },
      surprised: {
        smile: {},
        weights: { surprised: 1.0, oh: 0.65 },
        posture: { headPitch: -0.07, headYaw: 0, headRoll: 0, chestPitch: -0.05, shoulderLift: 0.055 }
      },
      sad: {
        smile: {},
        weights: { sad: 0.85, ou: 0.18 },
        posture: { headPitch: 0.08, headYaw: 0.01, headRoll: -0.025, chestPitch: 0.04, shoulderLift: -0.035 }
      },
      angry: {
        smile: {},
        weights: { angry: 0.85, ou: 0.32 },
        posture: { headPitch: 0.07, headYaw: -0.01, headRoll: -0.015, chestPitch: 0.03, shoulderLift: 0.025 }
      },
      dying: {
        smile: {},
        weights: { sad: 0.75, blink: 0.9 },
        posture: { headPitch: 0.1, headYaw: 0.02, headRoll: -0.04, chestPitch: 0.05, shoulderLift: -0.03 }
      }
    };
  }

  /**
   * Set active emotion or tailored movement recipe
   * @param {string} profileName
   * @param {number} [intensity=1.0]
   */
  setEmotion(profileName, intensity = 1.0) {
    this.activeEmotion = profileName;

    // Reset target blendshapes
    for (const name of this.managedExpressions) {
      this.targetWeights[name] = 0.0;
    }
    this.targetSmileJoy = 0.0;
    this.targetSmileFun = 0.0;

    const safeIntensity = Math.max(0, Math.min(1.0, intensity));

    const recipe = this.facialProfiles[profileName];
    if (recipe) {
      // 1. Apply independent smile morphs (EYES STAY WIDE OPEN)
      if (recipe.smile) {
        this.targetSmileJoy = (recipe.smile.joy || 0) * safeIntensity;
        this.targetSmileFun = (recipe.smile.fun || 0) * safeIntensity;
      }

      // 2. Apply standard VRM blendshapes
      if (recipe.weights) {
        for (const [key, val] of Object.entries(recipe.weights)) {
          if (this.managedExpressions.includes(key)) {
            this.targetWeights[key] = val * safeIntensity;
          }
        }
      }

      // 3. Apply emotional body posture offsets
      if (recipe.posture) {
        const p = recipe.posture;
        this.targetBodyOffsets = {
          headPitch: (p.headPitch || 0) * safeIntensity,
          headYaw: (p.headYaw || 0) * safeIntensity,
          headRoll: (p.headRoll || 0) * safeIntensity,
          chestPitch: (p.chestPitch || 0) * safeIntensity,
          shoulderLift: (p.shoulderLift || 0) * safeIntensity,
        };
      }
    } else {
      // Fallback or direct standard VRM blendshape (e.g. blinkLeft, blinkRight, blink, etc.)
      if (profileName.startsWith('happy')) {
        this.targetSmileJoy = 0.85 * safeIntensity;
      } else if (profileName === 'relaxed') {
        this.targetSmileFun = 0.6 * safeIntensity;
      } else if (this.managedExpressions.includes(profileName)) {
        this.targetWeights[profileName] = 1.0 * safeIntensity;
      }
    }
  }

  /**
   * Set mouth shape (viseme) manually
   * @param {string} viseme 
   * @param {number} intensity 
   */
  setViseme(viseme, intensity = 1.0) {
    const visemes = ['aa', 'ih', 'ou', 'ee', 'oh'];
    for (const v of visemes) {
      this.targetWeights[v] = (v === viseme) ? intensity : 0.0;
    }
  }

  resetToNeutral() {
    this.setEmotion('neutral');
  }

  /**
   * Update both facial expression and emotional body posture smoothly
   * @param {number} delta - Frame time in seconds
   */
  update(delta) {
    const factor = 1.0 - Math.exp(-9.0 * delta);

    // 1. Update Open-Eyed Smile Morphs directly on Face mesh
    this.currentSmileJoy += (this.targetSmileJoy - this.currentSmileJoy) * factor;
    this.currentSmileFun += (this.targetSmileFun - this.currentSmileFun) * factor;

    if (this.faceMesh && this.morphIndices) {
      if (this.morphIndices.mthJoy !== undefined) {
        this.faceMesh.morphTargetInfluences[this.morphIndices.mthJoy] = this.currentSmileJoy;
      }
      if (this.morphIndices.brwJoy !== undefined) {
        this.faceMesh.morphTargetInfluences[this.morphIndices.brwJoy] = this.currentSmileJoy * 0.85;
      }
      if (this.morphIndices.mthFun !== undefined) {
        this.faceMesh.morphTargetInfluences[this.morphIndices.mthFun] = this.currentSmileFun;
      }
      if (this.morphIndices.brwFun !== undefined) {
        this.faceMesh.morphTargetInfluences[this.morphIndices.brwFun] = this.currentSmileFun * 0.85;
      }
    }

    // 2. Update Standard VRM Expressions (visemes, winks, eyebrows)
    if (this.expressionManager) {
      // Ensure happy and relaxed presets do NOT override our open eyes
      this.expressionManager.setValue('happy', 0);
      this.expressionManager.setValue('relaxed', 0);

      for (const name of this.managedExpressions) {
        const current = this.currentWeights[name];
        const target = this.targetWeights[name];

        if (Math.abs(target - current) > 0.001 || target > 0) {
          const next = current + (target - current) * factor;
          this.currentWeights[name] = next;
          this.expressionManager.setValue(name, Math.max(0, Math.min(1, next)));
        } else if (current !== 0) {
          this.currentWeights[name] = 0;
          this.expressionManager.setValue(name, 0);
        }
      }
    }

    // 3. Interpolate Body Posture Offsets
    for (const key of Object.keys(this.targetBodyOffsets)) {
      this.currentBodyOffsets[key] += (this.targetBodyOffsets[key] - this.currentBodyOffsets[key]) * factor;
    }
  }

  /**
   * Returns current emotional body language rotation offsets
   */
  getBodyOffsets() {
    return this.currentBodyOffsets;
  }
}
