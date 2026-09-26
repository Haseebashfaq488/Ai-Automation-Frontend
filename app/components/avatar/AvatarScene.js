import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * AvatarScene
 * Sets up a cinematic studio presentation environment:
 * - High-res studio background with realistic ambient depth
 * - Soft cinematic 3-point lighting matching the room color palette
 * - Front-focused portrait camera framing with constrained orbit controls
 */
export class AvatarScene {
  constructor(container) {
    this.container = container;

    // 1. Scene
    this.scene = new THREE.Scene();

    // Load background texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('/avatar/background.jpg', (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = texture;
    });

    // 2. Camera: 30° FOV for a natural portrait compression (avoiding fish-eye distortion)
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 20.0);
    this.camera.position.set(0, 1.35, 1.25);

    // 3. Renderer with modern color management and tone mapping
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // 4. OrbitControls constrained to Front Portion
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 1.8;

    // Constrain viewing angle to front portion only (no back-of-head or weird angles)
    this.controls.minAzimuthAngle = -Math.PI / 4.5; // ~ -40° max left rotation
    this.controls.maxAzimuthAngle = Math.PI / 4.5;  // ~ +40° max right rotation
    this.controls.minPolarAngle = Math.PI / 2.5;    // ~ 72° max look down
    this.controls.maxPolarAngle = Math.PI / 1.85;   // ~ 97° max look up

    this.controls.target.set(0, 1.25, 0);
    this.controls.update();

    // 5. Lighting Setup
    this.setupLighting();

    // 6. Handle window resize
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  setupLighting() {
    // Ambient light: Soft global fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    // Key Light: Warm soft directional light from front-right
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.6);
    keyLight.position.set(1.2, 2.0, 1.6);
    this.scene.add(keyLight);

    // Fill Light: Soft cyan/slate tone matching the background office ambient
    const fillLight = new THREE.DirectionalLight(0xcdeafe, 0.9);
    fillLight.position.set(-1.4, 1.4, 1.2);
    this.scene.add(fillLight);

    // Rim / Backlight: Clean cool blue light highlighting hair and shoulders
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(0.0, 2.2, -1.8);
    this.scene.add(rimLight);
  }

  /**
   * Adjust camera and orbit controls to frame the avatar at chest/head level.
   * Focuses on the front portrait portion.
   * @param {any} vrm - Loaded VRM instance
   */
  frameAvatar(vrm) {
    this.scene.updateMatrixWorld(true);
    const headNode = vrm.humanoid?.getNormalizedBoneNode('head');
    let targetY = 1.22;

    if (headNode) {
      const headPos = new THREE.Vector3();
      headNode.getWorldPosition(headPos);
      targetY = headPos.y - 0.16; // Centers upper chest & face in frame
    }

    this.controls.target.set(0, targetY, 0);
    this.camera.position.set(0, targetY + 0.05, 1.18);
    this.controls.update();
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.renderer?.domElement && this.container?.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer?.dispose();
  }
}
