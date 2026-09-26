import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { retargetAnimation } from 'vrm-mixamo-retarget';

/**
 * VRMAnimationManager
 * Universal animation loader supporting both:
 * 1. Standard VRM Animation files (.vrma)
 * 2. Raw Adobe Mixamo FBX files (.fbx) with automatic retargeting
 */
export class VRMAnimationManager {
  constructor(vrm) {
    this.vrm = vrm;
    this.mixer = new THREE.AnimationMixer(vrm.scene);

    // GLTF loader configured with official VRMA animation plugin
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    // FBX loader for raw Mixamo files
    this.fbxLoader = new FBXLoader();

    // Cache of loaded AnimationClips
    this.clips = new Map();
    this.currentAction = null;
    this.activeAnimationName = null;

    // Listen for completion of non-looping clips and smoothly return to idle
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.currentAction) {
        console.log(`[VRMAnimationManager] Finished single-shot animation: ${this.activeAnimationName}`);
        this.stop(0.4);
      }
    });

    // Available animation catalog
    this.catalog = {
      // Greetings & Bows
      greeting: '/avatar/animations/Greeting.vrma',
      waving: '/avatar/animations/Waving.vrma',
      wave: '/avatar/animations/Goodbye.vrma',
      standing_greeting: '/avatar/animations/StandingGreeting.vrma',
      salute_greeting: '/avatar/animations/SaluteGreeting.vrma',
      bow: '/avatar/animations/Bow.vrma',
      formal_bow: '/avatar/animations/FormalBow.vrma',

      // Cute, Affection & Shyness
      shy: '/avatar/animations/Shy.vrma',
      heart_hands: '/avatar/animations/HeartHands.vrma',
      peace_sign: '/avatar/animations/PeaceSign.vrma',
      cute_pose: '/avatar/animations/CutePose.vrma',
      cat_pose: '/avatar/animations/CatPose.vrma',
      blowing_kiss: '/avatar/animations/BlowingKiss.vrma',
      blush: '/avatar/animations/Blush.vrma',
      cute_idle: '/avatar/animations/CuteIdle.vrma',
      show_off_ring: '/avatar/animations/ShowOffRing.vrma',

      // Conversational Assistant & Explaining
      talking: '/avatar/animations/Talking.vrma',
      presenting: '/avatar/animations/Presenting.vrma',
      nodding: '/avatar/animations/Nodding.vrma',
      shake_no: '/avatar/animations/ShakeHeadNo.vrma',
      task_received: '/avatar/animations/TaskReceived.vrma',
      pointing_thinking: '/avatar/animations/PointingThinking.vrma',
      check_time: '/avatar/animations/CheckTime.vrma',
      thankful: '/avatar/animations/Thankful.vrma',
      shrugging: '/avatar/animations/Shrugging.vrma',
      thinking: '/avatar/animations/Thinking.vrma',

      // Happiness & Encouragement
      joyful_jump: '/avatar/animations/JoyfulJump.vrma',
      happy_gesture: '/avatar/animations/HappyGesture.vrma',
      happy_idle: '/avatar/animations/HappyIdle.vrma',
      encouraging: '/avatar/animations/Encouraging.vrma',
      clapping: '/avatar/animations/Clapping.vrma',
      cheering: '/avatar/animations/Cheering.fbx',

      // Casual Postures & Idles
      custom_idle_8s: '/avatar/animations/CustomIdle8s.vrma',
      curious_leaning: '/avatar/animations/CuriousLeaning.vrma',
      hands_on_hips: '/avatar/animations/HandsOnHips.vrma',
      neck_stretch: '/avatar/animations/NeckStretch.vrma',
      look_around: '/avatar/animations/LookAround.vrma',
      relax: '/avatar/animations/Relax.vrma',
      relieved: '/avatar/animations/RelievedSigh.vrma',
      sleepy: '/avatar/animations/Sleepy.vrma',
      model_pose: '/avatar/animations/ModelPose.vrma',

      // Emotional Reactions
      surprised: '/avatar/animations/Surprised.vrma',
      sad: '/avatar/animations/Sad.vrma',
      angry: '/avatar/animations/Angry.vrma',
      dying: '/avatar/animations/Dying.fbx'
    };
  }

  /**
   * Preload or fetch an animation clip (supports both .vrma and .fbx)
   * @param {string} name 
   * @returns {Promise<THREE.AnimationClip>}
   */
  async loadClip(name) {
    if (this.clips.has(name)) {
      return this.clips.get(name);
    }

    const url = this.catalog[name];
    if (!url) {
      throw new Error(`Unknown animation: ${name}`);
    }

    let clip;

    if (url.toLowerCase().endsWith('.fbx')) {
      // Load raw Mixamo FBX and retarget to VRM Humanoid
      console.log(`[VRMAnimationManager] Loading and retargeting FBX from: ${url}`);
      const fbxAsset = await this.fbxLoader.loadAsync(url);
      const clipName = fbxAsset.animations[0]?.name || 'mixamo.com';

      clip = retargetAnimation(fbxAsset, this.vrm, { animationClipName: clipName });
      if (!clip) {
        throw new Error(`Failed to retarget FBX animation: ${url}`);
      }
    } else {
      // Standard VRMA format
      console.log(`[VRMAnimationManager] Loading VRMA from: ${url}`);
      const gltf = await this.gltfLoader.loadAsync(url);

      const vrmAnimation = gltf.userData.vrmAnimation ||
                           (gltf.userData.vrmAnimations && gltf.userData.vrmAnimations[0]);

      if (!vrmAnimation) {
        throw new Error(`No VRM animation data found in ${url}`);
      }

      clip = createVRMAnimationClip(vrmAnimation, this.vrm);
    }

    clip.name = name;

    // Apply custom programmatic modifications to standard mocap tracks
    this.customizeClip(name, clip);

    this.clips.set(name, clip);
    console.log(`[VRMAnimationManager] Successfully loaded '${name}' (${clip.tracks.length} tracks, ${clip.duration.toFixed(2)}s)`);
    return clip;
  }

  /**
   * Modify animation tracks programmatically.
   * e.g., scales down head/neck tilt on 'thinking' by 50%.
   * @param {string} name - Animation name
   * @param {THREE.AnimationClip} clip - Three.js AnimationClip
   */
  customizeClip(name, clip) {
    if (name === 'thinking') {
      const headBoneName = this.vrm.humanoid?.getNormalizedBoneNode('head')?.name;
      const neckBoneName = this.vrm.humanoid?.getNormalizedBoneNode('neck')?.name;
      const identityQuat = new THREE.Quaternion(0, 0, 0, 1);
      const tempQuat = new THREE.Quaternion();

      clip.tracks.forEach((track) => {
        const isHeadOrNeck = (headBoneName && track.name === `${headBoneName}.quaternion`) ||
                             (neckBoneName && track.name === `${neckBoneName}.quaternion`) ||
                             track.name.toLowerCase().includes('head.quaternion') ||
                             track.name.toLowerCase().includes('neck.quaternion');

        if (isHeadOrNeck) {
          for (let i = 0; i < track.values.length; i += 4) {
            tempQuat.set(
              track.values[i],
              track.values[i + 1],
              track.values[i + 2],
              track.values[i + 3]
            );

            tempQuat.slerp(identityQuat, 0.5);

            track.values[i] = tempQuat.x;
            track.values[i + 1] = tempQuat.y;
            track.values[i + 2] = tempQuat.z;
            track.values[i + 3] = tempQuat.w;
          }
        }
      });
    }
  }

  /**
   * Play an animation with smooth cross-fading
   * @param {string} name - e.g. 'clapping', 'wave', 'dying'
   * @param {object} options - { loop: boolean, fadeDuration: number }
   */
  async play(name, options = {}) {
    const fadeDuration = options.fadeDuration ?? 0.35;
    const loop = options.loop ?? true;

    try {
      const clip = await this.loadClip(name);
      const newAction = this.mixer.clipAction(clip);

      newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
      newAction.clampWhenFinished = !loop;

      if (this.currentAction && this.currentAction !== newAction) {
        newAction.reset();
        newAction.setEffectiveTimeScale(1.0);
        newAction.setEffectiveWeight(1.0);
        newAction.crossFadeFrom(this.currentAction, fadeDuration, true);
        newAction.play();
      } else {
        newAction.reset();
        newAction.setEffectiveTimeScale(1.0);
        newAction.setEffectiveWeight(1.0);
        newAction.fadeIn(fadeDuration);
        newAction.play();
      }

      this.currentAction = newAction;
      this.activeAnimationName = name;
      console.log(`[VRMAnimationManager] Now playing: ${name}`);
    } catch (err) {
      console.error(`Failed to play animation '${name}':`, err);
    }
  }

  /**
   * Stop the active animation and smoothly blend back to idle
   * @param {number} fadeDuration 
   */
  stop(fadeDuration = 0.4) {
    if (this.currentAction) {
      this.currentAction.fadeOut(fadeDuration);
      const actionToStop = this.currentAction;
      setTimeout(() => {
        if (!this.activeAnimationName) {
          actionToStop.stop();
          if (this.currentAction === actionToStop) {
            this.currentAction = null;
          }
        }
      }, fadeDuration * 1000);
    }
    this.activeAnimationName = null;
    console.log('[VRMAnimationManager] Stopped animation');
  }

  hasActiveAction() {
    return Boolean(
      this.activeAnimationName &&
      this.currentAction &&
      this.currentAction.isRunning() &&
      this.currentAction.getEffectiveWeight() > 0.05
    );
  }

  /**
   * Update animation mixer every frame
   * @param {number} delta - Frame delta time in seconds
   */
  update(delta) {
    this.mixer.update(delta);
  }
}
