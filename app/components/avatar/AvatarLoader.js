import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export class AvatarLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));
  }

  /**
   * Load and inspect a VRM model.
   * @param {string} url - URL or asset path to the VRM file
   * @param {function} onProgress - Progress callback
   * @returns {Promise<{vrm: any, inspection: object}>}
   */
  async load(url, onProgress) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const vrm = gltf.userData.vrm;
          if (!vrm) {
            reject(new Error('No VRM instance found in GLTF data'));
            return;
          }

          // Normalize VRM 0.0 rotation to match VRM 1.0 (+Z forward)
          VRMUtils.rotateVRM0(vrm);

          // Disable frustum culling so hair/clothing physics don't pop out when rotating
          vrm.scene.traverse((obj) => {
            obj.frustumCulled = false;
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
            }
          });

          // Inspect the VRM
          const inspection = this.inspectVRM(vrm, gltf);

          resolve({ vrm, inspection });
        },
        (progress) => {
          if (onProgress) {
            onProgress(progress);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Inspect all VRM features according to Phase 1 specification
   */
  inspectVRM(vrm, gltf) {
    const meta = vrm.meta || {};
    const humanoid = vrm.humanoid;
    const expressionManager = vrm.expressionManager;
    const lookAt = vrm.lookAt;
    const springBoneManager = vrm.springBoneManager;

    // Detect available expressions
    const expressionNames = [];
    if (expressionManager && expressionManager.expressions) {
      if (Array.isArray(expressionManager.expressions)) {
        expressionNames.push(...expressionManager.expressions.map((e) => e.expressionName));
      } else {
        expressionNames.push(...Object.keys(expressionManager.expressions));
      }
    }

    // Check blink availability
    const hasBlink = expressionNames.some((name) =>
      ['blink', 'blink_l', 'blink_r', 'blinkleft', 'blinkright'].includes(name.toLowerCase())
    );

    // Detect available humanoid bones
    const availableBones = [];
    if (humanoid) {
      const standardBones = [
        'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
        'leftEye', 'rightEye', 'jaw',
        'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
        'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
        'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
        'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
      ];
      for (const boneName of standardBones) {
        if (humanoid.getNormalizedBoneNode(boneName) || humanoid.getRawBoneNode(boneName)) {
          availableBones.push(boneName);
        }
      }
    }

    // Spring bones / physics
    const springJointCount = springBoneManager?.joints ? springBoneManager.joints.size || springBoneManager.joints.length || 0 : 0;
    const springColliderCount = springBoneManager?.colliderGroups ? springBoneManager.colliderGroups.length || 0 : 0;

    // Animations in GLTF
    const animationClipCount = gltf.animations?.length || 0;

    const inspection = {
      vrmVersion: meta.metaVersion || (meta.vrmVersion ? `VRM ${meta.vrmVersion}` : 'VRM 0.x / 1.0'),
      title: meta.title || meta.name || 'Unnamed Avatar',
      author: meta.authors || meta.author || 'Unknown',
      humanoidBonesCount: availableBones.length,
      availableBones,
      expressions: expressionNames,
      hasBlink,
      hasLookAt: Boolean(lookAt),
      springBones: {
        supported: Boolean(springBoneManager),
        jointCount: springJointCount,
        colliderCount: springColliderCount
      },
      animationClips: animationClipCount
    };

    this.logInspectionReport(inspection);

    return inspection;
  }

  logInspectionReport(info) {
    console.group('--- VRM INSPECTION REPORT ---');
    console.log(`VRM Version: ${info.vrmVersion}`);
    console.log(`Title: ${info.title} (by ${info.author})`);
    console.log(`Humanoid Bones: ${info.humanoidBonesCount} detected (${info.availableBones.slice(0, 8).join(', ')}...)`);
    console.log(`Expressions (${info.expressions.length}):`, info.expressions);
    console.log(`Blink Support: ${info.hasBlink ? 'YES' : 'NO'}`);
    console.log(`LookAt Support: ${info.hasLookAt ? 'YES' : 'NO'}`);
    console.log(`SpringBones: ${info.springBones.supported ? 'YES' : 'NO'} (${info.springBones.jointCount} joints, ${info.springBones.colliderCount} colliders)`);
    console.log(`Animation Clips: ${info.animationClips}`);
    console.groupEnd();
  }
}
