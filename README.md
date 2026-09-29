# RoomPulse · Standalone AI Meeting Assistant

A privacy-first meeting assistant that reads the room vibe entirely in the browser.

## Standalone file

The complete application is available as one file:

```text
/home/vikas/Projects/AI Meeting Assistant/standalone.html
```

`index.html` is also the same standalone version. Neither file requires React, npm, Tailwind, Vite, or a build step.

### Run the standalone file

Camera access requires a secure context. Do not double-click the file with `file://`; serve it from localhost instead:

```bash
cd "/home/vikas/Projects/AI Meeting Assistant"
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080/standalone.html
```

For production, host the same file over HTTPS.

The UI, camera lifecycle, error handling, 4 FPS face detection, canvas overlay, and seven-class facial-expression inference are inline in the HTML. MediaPipe, face-api.js, and the expression model are loaded on demand from public CDNs when the camera starts, so an internet connection is required. Camera frames remain in the browser and are not uploaded.

## Optional Vite project

The original modular React/Vite source remains under `src/` for continued development, but it is not required to run the standalone version.

## Current status: Phase 2

The standalone app includes:

- Working start/stop camera controls
- Camera permission, missing-device, insecure-context, and already-in-use errors
- MediaPipe face detection with confidence labels and bounding boxes
- A seven-class facial-expression model: neutral, happy, sad, angry, fearful, disgusted, and surprised
- Five-sample rolling expression smoothing
- Positive-expression and tension-proxy summaries (not claims about internal emotional state)
- 4 FPS sampling to bound CPU/GPU work
- Local-only video processing

Facial-expression output is a probabilistic computer-vision estimate, not a diagnosis or a reliable measure of a person’s internal emotional state.
# Room-Pulse
# Room-Pulse
