# `app/avatar-studio/` — 3D Avatar Testing Studio

## 1. Directory Role & Boundary
The `app/avatar-studio/` directory houses the interactive playground and QA testing studio for the 3D VRM avatar system (`/avatar-studio`).
It provides real-time manual testing and preview controls for:
1. All **43 mocap animations** with immediate trigger and loop controls.
2. **Facial expressions and viseme blendshapes** (AA, EE, IH, OH, OU).
3. **Interactive assistant modes** (`idle`, `listening`, `speaking`).
4. **Speech sandbox**: Editing custom speech scripts with inline delimiters (`<<<gesture:...>>>`), testing Edge Neural TTS playback, and observing real-time voice amplitude analysis.
5. **Camera framing tools**: Quick perspective toggles (`Face`, `Portrait`, `Full Body`).

---

## 2. File Inventory
| File | Role | Key Exports / Responsibilities |
| :--- | :--- | :--- |
| [`page.js`](file:///d:/AI-Automation/AI-Automation%20Frontend/app/avatar-studio/page.js) | Testing Studio Page | Full-screen dual-column workspace: left viewport with HUD status and camera tools; right control deck with tabbed motion catalog, visemes, modes, and speech sandbox. |

---

## 3. Control Deck Tabs & Capabilities

### Tab 1: Gestures (43 Mocaps)
- Categorized into 6 groups: Greetings & Bows, Cute & Affection, Dialogue & Explaining, Happiness & Cheering, Casual & Poses, Drama & Reactions.
- Includes a live search filter.
- **Loop Toggle**: Plays animations continuously or as single-shot transitions.
- **Stop Motion**: Instantly cancels active animation and returns avatar to resting idle posture.

### Tab 2: Expressions & Visemes
- **10 Emotion Presets**: Neutral, Happy Smile, Radiant Joy, Heartfelt Love, Excited Cheerful, Serene Relaxed, Receptive Listening, Wide-Eyed Surprise, Gentle Pout, Frustrated Pout.
- **Phoneme Viseme Buttons**: Directly activates VRM mouth visemes (`AA`, `EE`, `IH`, `OH`, `OU`) for lip-sync calibration.

### Tab 3: Modes & States
- **Idle**: Standard conversational resting mode with harmonic micro-sway and procedural breathing.
- **Listening**: Forward-tilted attentive posture, locked gaze, and periodic affirmative nods.
- **Speaking**: Activates dynamic procedural lip visemes and speech gestures.

### Tab 4: Speech & Delimiter Sandbox
- Preset demonstration scripts showcasing greeting, affection, professional assistant, and celebratory choreographies.
- Textarea allowing custom inline delimiters (e.g. `<<<gesture: greeting, expression: happy_wave>>> Hello!`).
- Edge TTS voice selector (Ava, Jenny, Sonia, Guy, Christopher, Brian).
- Direct DOM real-time voice amplitude gauge.

---

## 4. Critical Invariants & Gotchas

* **Uncoupled Model Lifecycle**:
  - The studio passes a memoized `handleLoaded` callback (`useCallback(..., [])`) to `AvatarCanvas`.
  - Clicking any button on the page must NEVER reload or recreate the Three.js scene.
* **Direct DOM Audio Metering**:
  - Audio amplitude is read from `getLiveAudioVolume()` in an animation frame and applied directly to `volumeBarRef.current.style.width` to guarantee 0 React re-renders while audio plays.
