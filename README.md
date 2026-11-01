# Starry Night — After the Brush

A small, peaceful 3D cat-finding game inspired by Vincent van Gogh’s *The Starry Night*. Wander a painted village, meet eight cats, and fill a field journal. No timer, accounts, or external services.

## Play

[Download the ready-to-play game ZIP](https://github.com/Dextheking1/Starry-Night/raw/refs/heads/main/downloads/Starry-Night.zip), unzip it, and open **Starry Night.html** in a current browser. No installation is needed.

The [standalone HTML](downloads/starry-night.html) is also included in this repository. Use GitHub’s **Download raw file** button to save it. It includes the game, painted textures, and fonts and needs no asset downloads while playing. WebGL is required; hardware acceleration is recommended.

To rebuild this edition from source, run `npm run build:standalone`; the result is `dist/starry-night.html`.

For local development (Node.js 20.19+ or 22.12+):

```sh
npm ci
npm run dev
```

Vite prints the local development address. To create a deployable static site:

```sh
npm run build
npm run preview
```

Deploy the `dist/` directory to a static web host. The application contains no backend or required environment variables. To produce the single-file edition:

```sh
npm run build:standalone
```

## Controls

- **WASD / arrow keys**: walk; mouse: look. If mouse capture is unavailable, drag to look.
- **Click** a nearby cat, or aim at it and press **E / Space**: say hello.
- **H**: a hint for the nearest undiscovered cat.
- **J**: field journal. **Escape**: pause.
- Touch screens: left thumbstick to move, drag the scene to look, tap a cat or the cat button to spot it.
- Sound is optional and starts only after selecting the sound control.

Finds are saved in this browser’s local storage. Private browsing or storage restrictions may prevent persistence. After collecting all eight cats, keep exploring or choose “Begin a new cat hunt” in the completion or pause screen to reset the journal. No telemetry or remote data storage is used.

## Validation

```sh
npm test
npm run test:browser
```

The browser suite starts Vite if needed, or uses a running server at `http://127.0.0.1:5173`, and Chromium at `/usr/bin/chromium` (or `CHROMIUM_PATH` if set). It exercises movement, collisions/occlusion, all eight discoveries, hints, journal, saved progress, completion/reset, and a touch-screen viewport. The `?test=1` development-only hook supports camera placement for repeatable tests and is removed from production builds.

## Implementation

Vanilla JavaScript, Three.js, and Vite. The sky, painted materials, architecture, scenery, cats, and ambient audio are procedural and generated locally. Fonts are bundled from Fontsource (Cormorant Garamond and DM Sans, SIL Open Font License). This is an original stylized scene inspired by the public-domain painting, rather than a photogrammetric reconstruction.

- `src/world.js`: painted village, sky, landmarks, collision bounds, and cat locations.
- `src/cats.js`: cat models and animations.
- `src/main.js`: renderer, controls, picking, journal, and game state.
- `src/gameplay.js`: movement, collision, compass, and persistence helpers.
- `src/audio.js`: optional synthesized nocturne and discovery tones.

The standalone production file was checked in Chromium with every additional network request blocked: the scene and journal rendered without errors or asset requests. Direct `file://` validation was unavailable because the managed browser blocks local-file navigation.

The source and ready-to-play files are included in this repository. A Sites deployment is not configured.
