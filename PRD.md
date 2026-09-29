# Product Requirements Document: RoomPulse (AI Meeting Assistant)

| | |
|---|---|
| **Version** | 1.0 (Draft) |
| **Date** | 2026-09-29 |
| **Status** | In development |
| **Stack summary** | FastAPI · MediaPipe BlazeFace (Short-Range) · HSEmotion (ONNX) · Vite + TypeScript frontend |

---

## 1. Overview

RoomPulse is a web-based meeting assistant that reads facial expressions from a live camera feed and reports the overall mood of the room in real time. For every detected face it produces an expression label (**Happy/Good, Neutral, Sad, Unhappy**) and aggregates these into a "meeting pulse" shown on a live dashboard.

The product reports **observable facial expression**, not internal emotion. This framing must be visible in the UI (it already is: *"Facial expression is an observable signal, not a direct reading of internal emotion."*).

## 2. Problem Statement

In online and hybrid meetings, hosts, teachers and presenters cannot easily read audience reactions. Cameras are small, gallery views are crowded, and attention is split. Presenters lack a simple, real-time signal of whether the room is engaged, confused or disengaged.

## 3. Goals and Non-Goals

### Goals
1. Detect all faces in the camera view in real time and classify each one's expression.
2. Aggregate results into a smoothed, easy-to-read room-level signal.
3. Run with low latency (under 300 ms from frame to dashboard update) on a typical laptop.
4. Keep privacy first: no video is stored, and only numeric scores leave the processing stage.
5. Store session history so users can review how mood changed over a meeting.

### Non-Goals (v1)
- Identifying or recognizing who a person is (no face recognition, no identity storage).
- Diagnosing mental state, stress, deception or performance of individuals.
- Audio, speech or text sentiment analysis.
- Native mobile apps.
- Automated integrations with Zoom/Meet/Teams (planned for later).

## 4. Target Users

| Persona | Need |
|---|---|
| **Presenter / Teacher** | Live feedback on audience engagement while speaking |
| **Meeting host / Manager** | Post-meeting summary of how the room responded |
| **Researcher / Team lead** | Aggregate trends across sessions |

## 5. Core Models

| Stage | Model | Notes |
|---|---|---|
| Face detection | **MediaPipe BlazeFace Short-Range** | 128×128 input, optimized for faces within about 2 m of the camera (webcam and selfie use). Returns bounding box, confidence and 6 keypoints (eyes, nose tip, mouth, ear tragions). |
| Emotion classification | **HSEmotion EmotiEffNet (`enet_b0_8_best_afew`), ONNX** | BlazeFace **only detects faces**; it does not classify expressions. A separate classifier is required. Trained on AffectNet, lightweight (EfficientNet-B0). |

**Known limitation of Short-Range BlazeFace:** it is tuned for close-up faces. Small faces (people far from the camera, or tiles in a large gallery view) may be missed. If testing shows poor recall in group scenarios, evaluate the BlazeFace Full-Range model (up to about 5 m) or a larger detector as a drop-in replacement. Keep the detector behind an interface so it can be swapped.

### Class handling
The 8-class HSEmotion model outputs: Anger, Contempt, Disgust, Fear, Happiness, Neutral, Sadness, Surprise.

| Model output | Product label |
|---|---|
| Happiness | **Happy / Good** |
| Neutral | **Neutral** |
| Sadness | **Sad** |
| Anger, Contempt, Disgust, Fear | **Unhappy** |
| Surprise | Shown separately, **not** counted as positive or negative |

## 6. Functional Requirements

### P0: Must have
| ID | Requirement |
|---|---|
| F1 | Request webcam access via `getUserMedia`, with clear permission and error states. |
| F2 | Live camera preview with face bounding boxes and per-face label overlay. |
| F3 | Detect multiple faces per frame using BlazeFace Short-Range. |
| F4 | Classify each face crop into the emotion classes and map to product labels. |
| F5 | Smooth scores per session using a rolling average (about 2–3 s window) to prevent flicker. |
| F6 | Dashboard showing: overall signal, dominant expression and confidence, positive expression %, tension proxy %, and per-class bars. |
| F7 | Start/Stop live session controls and a visible "camera on" indicator. |
| F8 | Expose a FastAPI backend with REST and WebSocket endpoints (see section 8). |
| F9 | Consent notice shown before the camera starts. |

### P1: Should have
| ID | Requirement |
|---|---|
| F10 | Session history: timeline chart of the mood over time, saved per session. |
| F11 | Ignore low-quality detections (confidence below 0.6, face smaller than 60 px, heavily rotated). |
| F12 | Per-person neutral baseline calibration (first 5 seconds). |
| F13 | Export session summary as CSV/JSON. |
| F14 | Edge mode toggle: run inference in the browser and send only scores to the server. |

### P2: Nice to have
| ID | Requirement |
|---|---|
| F15 | Screen-capture mode (`getDisplayMedia`) to analyze a Meet/Zoom gallery window. |
| F16 | Alerts, e.g. "Unhappy above 40% for 30 s". |
| F17 | Multi-user accounts and shared team dashboards. |

## 7. System Architecture

### Mode A: Server mode (FastAPI runs the models)
```
Browser (webcam) ──JPEG frames @ 5-10 fps──▶ FastAPI WebSocket
                                                │
                                   MediaPipe BlazeFace (detect + crop)
                                                │
                                   HSEmotion ONNX (classify each face)
                                                │
                                   Smoothing + label mapping
                                                │
Browser dashboard ◀──JSON scores (WebSocket)────┘
                                                │
                                        SQLite / Postgres (scores only)
```

### Mode B: Edge mode (default recommendation for privacy)
```
Browser: webcam → BlazeFace (@mediapipe/tasks-vision) → HSEmotion (onnxruntime-web)
        │
        └── numeric scores only ──▶ FastAPI ──▶ DB (session history)
```
In Edge mode, video never leaves the device.

Both modes share the same dashboard and the same score schema, so the frontend does not change between modes.

## 8. API Specification (FastAPI)

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/sessions` | Create a session, returns `session_id` |
| `POST` | `/api/sessions/{id}/end` | End a session and compute the summary |
| `GET` | `/api/sessions` | List past sessions |
| `GET` | `/api/sessions/{id}` | Session detail and timeline |
| `GET` | `/api/sessions/{id}/export?format=csv` | Export data |
| `WS` | `/ws/live/{session_id}` | Server mode: receive frames, send scores. Edge mode: receive scores only. |
| `GET` | `/api/health` | Health check and model load status |

### Score payload (server → client)
```json
{
  "ts": 1790673444,
  "faces": 2,
  "per_face": [
    { "id": 0, "bbox": [120, 80, 140, 140], "label": "Neutral", "confidence": 0.71 }
  ],
  "aggregate": {
    "overall": "Neutral",
    "confidence": 0.64,
    "classes": {
      "neutral": 0.64, "happy": 0.12, "sad": 0.0, "angry": 0.0,
      "fearful": 0.0, "disgusted": 0.0, "surprised": 0.25
    },
    "positive_pct": 0.12,
    "tension_pct": 0.0
  }
}
```

## 9. Data Model

**sessions**: `id`, `started_at`, `ended_at`, `mode` (server/edge), `avg_faces`, `summary_json`

**samples**: `id`, `session_id`, `ts`, `faces`, `class_scores_json`, `overall_label`

No images, video frames, face embeddings or identities are stored.

## 10. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + TypeScript (React optional), Recharts or Chart.js |
| Camera | Browser `getUserMedia` |
| Backend | FastAPI, Uvicorn, WebSockets, Pydantic |
| Face detection | MediaPipe BlazeFace Short-Range (`mediapipe` in Python, `@mediapipe/tasks-vision` in browser) |
| Emotion model | HSEmotion `enet_b0_8_best_afew` via `onnxruntime` / `onnxruntime-web` |
| Image handling | OpenCV / NumPy (crop, resize, BGR↔RGB) |
| Database | SQLite (dev), PostgreSQL (prod), SQLAlchemy |
| Deployment | Docker, Nginx reverse proxy, HTTPS (required for camera access) |

## 11. Inference Pipeline Details

1. **Capture** frame at 5–10 fps (not every frame).
2. **Detect** faces with BlazeFace; drop detections below the confidence threshold.
3. **Crop** each face with about 20% margin; optionally align using eye keypoints.
4. **Resize and normalize** to the emotion model's input (224×224), ensuring RGB order.
5. **Classify** to get class probabilities.
6. **Track** faces across frames (simple IoU matching) to smooth per person.
7. **Smooth** using an exponential moving average or a rolling window.
8. **Aggregate** across faces and map to product labels.
9. **Emit** the JSON payload to the dashboard.

**Tension proxy:** the combined smoothed probability of Angry + Disgusted + Fearful (+ Contempt). It is a heuristic indicator, not a measure of stress.

## 12. Non-Functional Requirements

| Category | Target |
|---|---|
| Latency | Under 300 ms end to end (frame → dashboard) |
| Throughput | 5–10 fps analysis with up to 6 faces on a mid-range laptop CPU |
| Availability | Backend health endpoint, graceful reconnect on WebSocket drop |
| Accuracy | Face detection recall of 90% or higher for faces within 2 m; emotion accuracy consistent with published benchmarks (around 65–75% for in-the-wild 7-class). Report results as room-level trends, not individual verdicts. |
| Security | HTTPS only, CORS restricted to the frontend origin, input validation on frames, rate limiting on WebSocket |
| Compatibility | Latest Chrome, Edge, Firefox; Safari best-effort |

## 13. Privacy, Ethics and Compliance

- **Consent first:** show a notice and require explicit opt-in before the camera starts. Meeting hosts must inform all participants they are being analyzed.
- **On-device by default:** prefer Edge mode; in Server mode, process frames in memory and discard immediately.
- **No identification:** no face recognition, no identity tracking across sessions.
- **Data minimization:** store only aggregate numeric scores. Provide a "delete session" option.
- **Transparency:** always display that the output is an expression signal, not a reading of true emotion, and that accuracy varies with lighting, angle, culture and individual differences.
- **Regulatory note:** emotion recognition may be restricted in workplace and education settings in some jurisdictions (for example, under the EU AI Act). Review local law before deploying in those contexts.
- **Not for decisions:** the product must not be used for hiring, performance evaluation, or disciplinary decisions.

## 14. Success Metrics

| Metric | Target |
|---|---|
| Live dashboard end-to-end latency | Under 300 ms (p95) |
| Face detection recall (internal test set) | 90% or higher |
| Label flicker (label changes per minute with a static expression) | Fewer than 2 |
| Session completion rate (start → stop without error) | 95% or higher |
| User-rated usefulness of the pulse (survey, 1–5) | 4.0 or higher |

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Short-Range BlazeFace misses distant or small faces | Undercounts people in group calls | Test with real gallery scenarios; swap to Full-Range or a larger detector behind the detector interface |
| Emotion model bias and lower accuracy across demographics, lighting and camera angles | Misleading readings | Calibration baseline, confidence thresholds, room-level aggregation, fine-tune on representative data |
| Privacy concerns from participants | Adoption and legal risk | Consent flow, on-device mode, no video storage, clear disclosure |
| High CPU use with many faces | Lag | Lower fps, resize frames, ONNX runtime optimizations, WebGPU in Edge mode |
| Misuse for evaluating people | Ethical harm | Terms of use, no individual-level reporting by default |

## 16. Milestones

| Phase | Scope | Duration |
|---|---|---|
| **M1: Prototype** | Webcam → BlazeFace → HSEmotion → live console output | 1 week |
| **M2: Backend** | FastAPI REST + WebSocket, score schema, smoothing | 1 week |
| **M3: Dashboard** | Live overview, per-class bars, overlays, consent flow | 1–2 weeks |
| **M4: History** | Session storage, timeline charts, export | 1 week |
| **M5: Hardening** | Edge mode, calibration, testing, Docker deployment | 1–2 weeks |

## 17. Open Questions

1. Will users analyze their own webcam only, or need to capture an existing meeting window (screen capture)?
2. Is Edge mode (browser inference) the default, or is server-side inference acceptable for v1?
3. What is the typical group size? If more than 6 people at a distance, Short-Range BlazeFace may not be sufficient.
4. Should "Surprised" be shown as its own category in the headline signal?
5. Is any fine-tuning on custom meeting data planned, and is there consent to collect it?