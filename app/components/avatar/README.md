# `app/components/avatar/` — 3D VRM Avatar & Mocap Engine

## 1. Directory Role & Boundary
The `app/components/avatar/` directory contains the complete Three.js WebGL and `@pixiv/three-vrm` runtime engine for Jarvis's 3D avatar. It provides:
1. High-fidelity VRM 0.x / 1.0 avatar loading, spring-bone hair/cloth physics, and upper-body portrait framing.
2. An extensive catalog of **43 mocap animations** (`.vrma` and Adobe Mixamo `.fbx` with automatic humanoid bone retargeting).
3. Expressive facial blendshapes, eye contact tracking (`AvatarGaze`), organic blink cadence (`AvatarBlink`), and procedural breathing (`AvatarBreathing`).
4. **Speech-Timed Choreography** (`AvatarChoreographer`): Parsing inline speech tags (`<<<gesture: ..., expression: ...>>>`) and synchronizing body animations and facial visemes with real-time Edge Neural TTS audio.
5. Autonomous interactive assistant states (`idle`, `listening`, `speaking`).

---

## 2. File Inventory & Responsibilities
| File | Role | Key Exports / Responsibilities |
| :--- | :--- | :--- |
| [`AvatarCanvas.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarCanvas.js) | React WebGL Canvas | Mounts Three.js viewport, handles model loading progress, wraps render loop, and bridges React state to the underlying 3D avatar instance. Memoized with `React.memo`. |
| [`VRMAvatar.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/VRMAvatar.js) | Avatar Coordinator | Top-level facade coordinating all skeletal, facial, gaze, breathing, idle, and assistant sub-systems during the per-frame `update(delta)` tick. |
| [`VRMAnimationManager.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/VRMAnimationManager.js) | Mocap & Clip Manager | Loads and caches 43 mocap clips (`.vrma` via `@pixiv/three-vrm-animation`, `.fbx` via `vrm-mixamo-retarget`). Supports cross-fading, loop modes, and duration inspection. |
| [`AvatarChoreographer.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarChoreographer.js) | Speech Choreographer | Parses inline speech cues (`<<<gesture: ...>>>`), computes segment durations based on word count and active audio duration, and fires coordinated gesture + emotion sequences. |
| [`AvatarAssistantMode.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarAssistantMode.js) | Interactive State Engine | Drives autonomous behaviors for `idle` (calm posture), `listening` (attentive forward posture, affirmative nods), and `speaking` (procedural viseme lip-sync). |
| [`AvatarExpression.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarExpression.js) | Facial Emotions & Visemes | Manages VRM blendshapes (`happy`, `relaxed`, `surprised`, `sad`, `angry`, mouth visemes `aa`, `ih`, `ou`, `ee`, `oh`) with smooth interpolation and body offset cues. |
| [`AvatarIdle.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarIdle.js) | Procedural Idle Motion | Multi-harmonic irrational sine-wave micro-motion for neck, head, spine, and shoulders to maintain organic life without mechanical repetition. |
| [`AvatarBreathing.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarBreathing.js) | Procedural Respiration | Sinusoidal chest and spine expansion/contraction representing resting breathing cycles. |
| [`AvatarBlink.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarBlink.js) | Spontaneous Blinking | Randomized natural blink timing (2.5s–6s intervals) with quick closing and slower opening eyelid curves. |
| [`AvatarGaze.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarGaze.js) | Head & Eye Tracking | Saccadic micro-eye movements and smooth camera tracking using VRM `lookAt`. |
| [`AvatarPose.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarPose.js) | Natural Resting Posture | Relaxes humanoid bones from rigid T-pose into a poised human posture (arms lowered, elbows bent, natural finger curl). |
| [`AvatarGestures.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarGestures.js) | Procedural Upper-Body | Hand and arm motions for conversational emphasis when mocap clips are not actively overriding skeletal tracks. |
| [`AvatarScene.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarScene.js) | Three.js World | Configures renderer, PerspectiveCamera, OrbitControls, three-point directional lighting, soft ambient light, and resize observer. |
| [`AvatarLoader.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/AvatarLoader.js) | VRM File Loader | Loads `.vrm` files, applies `VRMUtils.rotateVRM0`, disables frustum culling on mesh parts, and inspects available humanoid bones and blendshapes. |
| [`SemanticCueEngine.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/components/avatar/SemanticCueEngine.js) | Sentiment Parser | Secondary fallback rule engine mapping keywords to gestures if explicit delimiters are absent. |

---

## 3. Delimiter Syntax & Speech Choreography Pipeline

Antigravity and the LLM format conversational messages with inline markers:
```markdown
<<<gesture: greeting, expression: happy_wave>>> Hello! I am Jarvis. <<<gesture: task_received, expression: relaxed>>> I am ready to process your files.
```

### Choreography Flow:
1. **Text Parsing**: `AvatarChoreographer.parse(text)` splits the message into chronological segments with designated gestures and facial expressions.
2. **Audio Alignment**: If an active `Audio` element is playing via `playTTS()`, the total audio duration is distributed proportionally across segments based on word counts.
3. **Execution**: Segment 1 begins playing immediately; subsequent segments are queued to trigger exactly as their spoken words are reached.
4. **Cleanup & Handover**: When the final speech segment finishes (or audio ends), the avatar smoothly fades back into its base `idle` posture.

---

## 4. Critical Invariants & Gotchas

### Preventing VRM Reload on Re-Render
* **`onLoaded` Callback Isolation**:
  - In `AvatarCanvas.js`, `onLoaded` must **NEVER** be placed in the primary loading `useEffect` dependency array.
  - Store it in `const onLoadedRef = useRef(onLoaded)`. The model loading effect must only depend on `[avatarUrl]`.
  - Adding `onLoaded` directly to dependencies causes parent re-renders to tear down the Three.js scene (`scene.destroy()`) and reload the 20MB VRM model.
* **Component Memoization**:
  - `AvatarCanvas` is wrapped in `React.memo` so parent UI changes (such as tab switches, chat scrolling, or volume bar updates) do not trigger WebGL re-renders.

### Zero-Re-Render Audio Volume Polling
* **Direct DOM Updating**:
  - Never call `useState` (e.g. `setLiveVolume`) inside a 60fps `requestAnimationFrame` loop.
  - Pass a `volumeBarRef` and update `volumeBarRef.current.style.width` directly to avoid 60 React re-renders per second.

### VRM 0.x vs 1.0 Coordinate Normalization
* Always call `VRMUtils.rotateVRM0(vrm)` in `AvatarLoader.js` so models exported with VRM 0.0 specifications face forward (+Z axis) uniformly with VRM 1.0 assets.

---

## 5. Catalog of Supported Animations (43 Mocaps)

| Category | Animation IDs | Source Format |
| :--- | :--- | :--- |
| **Greetings & Bows** | `greeting`, `waving`, `wave`, `standing_greeting`, `salute_greeting`, `bow`, `formal_bow`, `thankful` | `.vrma` |
| **Cute & Affection** | `shy`, `heart_hands`, `peace_sign`, `cute_pose`, `cat_pose`, `blowing_kiss`, `blush`, `cute_idle` | `.vrma` |
| **Dialogue & Explaining** | `talking`, `presenting`, `nodding`, `shake_no`, `task_received`, `pointing_thinking`, `check_time`, `shrugging`, `thinking` | `.vrma` |
| **Happiness & Cheering** | `joyful_jump`, `happy_gesture`, `happy_idle`, `encouraging`, `clapping`, `cheering` | `.vrma` / `.fbx` |
| **Casual & Poses** | `curious_leaning`, `hands_on_hips`, `neck_stretch`, `look_around`, `relax`, `relieved`, `sleepy`, `model_pose` | `.vrma` |
| **Drama & Reactions** | `surprised`, `sad`, `angry`, `dying` | `.vrma` / `.fbx` |
