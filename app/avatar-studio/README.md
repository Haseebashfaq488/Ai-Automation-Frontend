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
- **Expression Intensity Slider**: Dynamic weight control from 10% (subtle) to 100% (expressive anime style) with 30%, 60%, 100% quick-dial pills.
- **Reset Neutral**: Quick 1-click reset returning facial morphs smoothly to resting neutral.
- **Section 1 — Basic VRM Core Emotions (6)**: Standard VRM blendshapes (`Neutral`, `Happy / Joy`, `Angry`, `Sad / Sorrow`, `Relaxed / Fun`, `Surprised / Shock`).
- **Section 2 — Eye & Wink Controls (3)**: Direct eyelid blendshapes (`Wink Left Eye`, `Wink Right Eye`, `Both Eyes Closed`).
- **Section 3 — Phoneme Viseme Shapes (5)**: Dedicated speech vowel mouth shapes (`AA`, `EE`, `IH`, `OH`, `OU`) with pronunciation hints and automatic 1s return timer.
- **Section 4 — Charm & Conversational Nuance (12)**: Handcrafted open-eyed emotion and dialogue profiles (`Radiant Joy`, `Heartfelt Love`, `Excited Cheerful`, `Shy Bashful`, `Neko Cat Mouth`, `Blowing Kiss`, `Blushing Sweet`, `Receptive Listening`, `Deep Thought`, `Quizzical Shrug`, `Sleepy Drowsy`, `Relieved Sigh`).

### Tab 3: Modes & States
- **Idle**: Standard conversational resting mode with harmonic micro-sway and procedural breathing.
- **Listening**: Forward-tilted attentive posture, locked gaze, and periodic affirmative nods.
- **Speaking**: Activates dynamic procedural lip visemes and speech gestures.

### Tab 4: Speech & Delimiter Sandbox
- Preset demonstration scripts showcasing greeting, affection, professional assistant, and celebratory choreographies.
- Textarea allowing custom inline delimiters (e.g. `<<<gesture: greeting, expression: happy_wave>>> Hello!`).
- **Synchronized Audio & Animation Engine**: Directly connects `playTTS` audio element with `AvatarChoreographer.playSequence(...)`:
  - Listens to audio playback timestamps in real-time.
  - Automatically triggers corresponding 3D gestures and facial expressions at the exact second each sentence/phrase is vocalized.
  - Live HUD updates (`activeGesture`, `activeEmotion`) in real-time as each spoken segment advances.
- Edge TTS voice selector (Ava, Ana, Aria, Emma, Jenny, Andrew).
- Direct DOM real-time voice amplitude gauge.

---

## 4. Critical Invariants & Gotchas

* **Uncoupled Model Lifecycle**:
  - The studio passes a memoized `handleLoaded` callback (`useCallback(..., [])`) to `AvatarCanvas`.
  - Clicking any button on the page must NEVER reload or recreate the Three.js scene.
* **Direct DOM Audio Metering**:
  - Audio amplitude is read from `getLiveAudioVolume()` in an animation frame and applied directly to `volumeBarRef.current.style.width` to guarantee 0 React re-renders while audio plays.
