# Technical Specification: RoomPulse (AI Meeting Assistant)

| | |
|---|---|
| **Version** | 1.0 (Draft) |
| **Date** | 2026-09-29 |
| **Companion doc** | `PRD.md` (product requirements) |
| **Scope** | Technical design and implementation contract for v1 |

---

## 1. System Summary

RoomPulse reads a live webcam stream, detects faces with **MediaPipe BlazeFace Short-Range**, classifies each face's expression with **HSEmotion (EmotiEffNet-B0, ONNX)**, smooths and aggregates the results, and serves them to a web dashboard through **FastAPI** (REST + WebSocket).

Output labels: **Happy/Good, Neutral, Sad, Unhappy**, with **Surprised** reported separately.

## 2. Architecture

### 2.1 Server mode
```
Browser ──JPEG frame (binary WS msg, 5-10 fps)──▶ FastAPI /ws/live/{session_id}
                                                     │
                                          decode → BlazeFace → crops
                                                     │
                                          HSEmotion ONNX (batched crops)
                                                     │
                                          tracker → smoother → aggregator
                                                     │
Browser dashboard ◀──────JSON payload (text WS msg)──┘
                                                     │
                                          SQLite/Postgres (scores only, 1 row/sec)
```

### 2.2 Edge mode
```
Browser: webcam → BlazeFace (@mediapipe/tasks-vision) → HSEmotion (onnxruntime-web)
         → tracker → smoother → aggregator → dashboard
         └─ POST/WS: aggregate scores only ─▶ FastAPI ─▶ DB
```
Both modes produce the identical **Score Payload** (section 6.3), so the dashboard is mode-agnostic.

## 3. Repository Layout

```
AI Meeting Assistant/
├── backend/
│   ├── main.py                 # FastAPI app factory, routers, lifespan (model load)
│   ├── config.py               # Pydantic Settings (env-driven)
│   ├── api/
│   │   ├── sessions.py         # REST routes
│   │   └── live.py             # WebSocket route
│   ├── ml/
│   │   ├── detector.py         # BlazeFace wrapper
│   │   ├── classifier.py       # HSEmotion wrapper
│   │   ├── tracker.py          # IoU face tracker
│   │   ├── smoothing.py        # EMA / rolling window
│   │   └── aggregate.py        # label mapping + room metrics
│   ├── db/
│   │   ├── models.py           # SQLAlchemy models
│   │   └── session.py          # engine / session factory
│   ├── schemas.py              # Pydantic request/response models
│   └── models/                 # *.tflite / *.onnx files (git-ignored, downloaded on setup)
├── src/                        # Vite + TypeScript frontend
│   ├── camera.ts               # getUserMedia + frame capture
│   ├── ws.ts                   # WebSocket client + reconnect
│   ├── edge/                   # optional in-browser inference
│   └── ui/                     # dashboard components
├── tests/
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 4. Environment and Dependencies

### Backend (Python 3.10+)
```
fastapi
uvicorn[standard]
pydantic-settings
mediapipe
onnxruntime
hsemotion-onnx
opencv-python-headless
numpy
sqlalchemy
aiosqlite          # or asyncpg for Postgres
python-multipart
pytest
httpx
```

### Frontend
```
vite, typescript
@mediapipe/tasks-vision      # edge mode
onnxruntime-web              # edge mode
recharts (or chart.js)
```

### Model files
| File | Source | Purpose |
|---|---|---|
| `blaze_face_short_range.tflite` | MediaPipe model card for Face Detector | Face detection |
| `enet_b0_8_best_afew.onnx` | Downloaded automatically by `hsemotion-onnx` | Emotion classification |

### Configuration (`config.py`, env vars)
| Variable | Default | Description |
|---|---|---|
| `DETECT_MIN_CONF` | `0.6` | Minimum BlazeFace confidence |
| `MIN_FACE_PX` | `60` | Minimum face width in pixels |
| `TARGET_FPS` | `8` | Server-side analysis rate cap |
| `SMOOTH_WINDOW_S` | `2.5` | Smoothing window |
| `MAX_FACES` | `8` | Faces processed per frame |
| `MAX_FRAME_BYTES` | `500000` | Reject larger WS frames |
| `DATABASE_URL` | `sqlite+aiosqlite:///./roompulse.db` | DB connection |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed origins |

## 5. ML Pipeline Specification

### 5.1 Face detection (`ml/detector.py`)
- Model: BlazeFace Short-Range, 128×128 input, optimized for faces within about 2 m.
- Output per face: bounding box, confidence score, 6 keypoints (right eye, left eye, nose tip, mouth center, right ear tragion, left ear tragion).
- Use the MediaPipe Tasks `FaceDetector` in `IMAGE` running mode (frames arrive independently over the socket).

```python
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

class FaceDetector:
    def __init__(self, model_path: str, min_conf: float = 0.6):
        opts = vision.FaceDetectorOptions(
            base_options=mp_python.BaseOptions(model_asset_path=model_path),
            running_mode=vision.RunningMode.IMAGE,
            min_detection_confidence=min_conf,
        )
        self.det = vision.FaceDetector.create_from_options(opts)

    def detect(self, rgb_frame):
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        result = self.det.detect(mp_img)
        faces = []
        for d in result.detections:
            b = d.bounding_box
            faces.append({
                "bbox": (b.origin_x, b.origin_y, b.width, b.height),
                "score": d.categories[0].score,
                "keypoints": d.keypoints,   # normalized coordinates
            })
        return faces
```

**Filtering rules:** discard faces with `score < DETECT_MIN_CONF`, `width < MIN_FACE_PX`, or bounding boxes that fall mostly outside the frame. Keep at most `MAX_FACES` (largest first).

**Known limitation:** Short-Range may miss small or distant faces. Detector is accessed only through the `detect(frame) -> list[Face]` interface so that Full-Range or another model can replace it without touching downstream code.

### 5.2 Crop and preprocessing
1. Expand the bounding box by 20% on each side and clamp to frame bounds.
2. Crop from the **RGB** frame (OpenCV frames are BGR, so convert once at decode time).
3. Optional alignment: rotate so the line between the eye keypoints is horizontal.
4. Resize to the classifier's input size (224×224); the `hsemotion-onnx` package handles resize and normalization internally.

### 5.3 Emotion classification (`ml/classifier.py`)
- Model: `enet_b0_8_best_afew` (8 classes).
- Class order: `Anger, Contempt, Disgust, Fear, Happiness, Neutral, Sadness, Surprise`.

```python
from hsemotion_onnx.facial_emotions import HSEmotionRecognizer
import numpy as np

CLASSES = ["anger", "contempt", "disgust", "fear",
           "happiness", "neutral", "sadness", "surprise"]

class EmotionClassifier:
    def __init__(self):
        self.rec = HSEmotionRecognizer(model_name="enet_b0_8_best_afew")

    def predict(self, face_rgb) -> np.ndarray:
        _, scores = self.rec.predict_emotions(face_rgb, logits=False)
        return np.asarray(scores, dtype=np.float32)   # shape (8,), sums to ~1
```

Verify the class order against the loaded model at startup (log it) rather than assuming it.

### 5.4 Face tracking (`ml/tracker.py`)
- Greedy IoU matching between consecutive detections; a match requires IoU of at least 0.3.
- Unmatched detections get a new `face_id`; tracks not seen for 1.5 s are dropped.
- Track IDs are per-session, in-memory only, and carry no identity information.

### 5.5 Smoothing (`ml/smoothing.py`)
- Per track: exponential moving average on the 8-class vector, `s = α·new + (1-α)·s`, with α derived from `SMOOTH_WINDOW_S` and the frame rate (default about 0.3).
- The displayed label changes only when a new class leads by a margin of at least 0.10 for at least 3 consecutive updates (hysteresis), to stop flicker.

### 5.6 Label mapping and aggregation (`ml/aggregate.py`)

| Model classes | Product label |
|---|---|
| happiness | Happy / Good |
| neutral | Neutral |
| sadness | Sad |
| anger + contempt + disgust + fear | Unhappy |
| surprise | Surprised (reported separately) |

Room-level metrics (over all active tracks, weighted equally):
- `classes`: mean of smoothed 8-class vectors.
- `overall`: product label with the highest aggregated score among Happy/Neutral/Sad/Unhappy; Surprised is displayed as a secondary value.
- `positive_pct`: aggregated `happiness` probability only (Surprise is **not** included).
- `tension_pct`: aggregated `anger + disgust + fear + contempt`. This is a heuristic, not a stress measure.
- With zero faces, the payload returns `faces: 0` and `overall: null`.

## 6. API Specification

Base path: `/api`. All bodies are JSON unless stated.

### 6.1 REST endpoints

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/api/sessions` | `{ "mode": "server" \| "edge" }` | `201 { "session_id": "uuid", "started_at": "ISO8601" }` |
| `POST` | `/api/sessions/{id}/end` | none | `200 SessionSummary` |
| `GET` | `/api/sessions` | query: `limit`, `offset` | `200 [SessionListItem]` |
| `GET` | `/api/sessions/{id}` | none | `200 SessionDetail` (includes timeline samples) |
| `DELETE` | `/api/sessions/{id}` | none | `204` |
| `GET` | `/api/sessions/{id}/export` | query: `format=csv\|json` | file download |
| `GET` | `/api/health` | none | `200 { "status": "ok", "models_loaded": true }` |

Error format: `{ "error": { "code": "string", "message": "string" } }` with standard HTTP status codes (`404` unknown session, `409` session already ended, `422` validation error).

### 6.2 WebSocket: `/ws/live/{session_id}`

**Server mode (client → server):**
- Binary message = one JPEG frame (max `MAX_FRAME_BYTES`; recommended 640×480, quality 0.7).
- Text message `{"type":"ping"}` for keepalive.

**Edge mode (client → server):**
- Text message `{"type":"scores","payload": <aggregate>}` at about 1 Hz.

**Server → client:**
- Text message containing a Score Payload (below).
- `{"type":"error","code":"...","message":"..."}` on failure.

**Behavior rules**
- The server processes only the **latest** frame; if inference is still running, incoming frames are dropped (no queue buildup).
- Frames are decoded and processed in memory and discarded; nothing image-related is written to disk or the database.
- Close codes: `1008` for unknown or ended session, `1009` for oversized frame, `1011` for internal error.
- The client reconnects with exponential backoff (1 s, 2 s, 4 s, capped at 10 s).

### 6.3 Score Payload
```json
{
  "type": "scores",
  "ts": 1790673444.512,
  "faces": 2,
  "per_face": [
    {
      "id": 0,
      "bbox": [120, 80, 140, 140],
      "label": "Neutral",
      "confidence": 0.71
    }
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
  },
  "latency_ms": 118
}
```
Notes: `bbox` is `[x, y, w, h]` in pixels of the submitted frame. `per_face` is omitted in Edge mode if the client chooses not to share per-face data. In the payload, `angry`/`fearful`/`disgusted` mirror the dashboard's seven bars; `contempt` is folded into `angry` for display and into `tension_pct` for the metric.

## 7. Data Model

### `sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `mode` | enum(`server`,`edge`) | |
| `started_at` | timestamp | |
| `ended_at` | timestamp, nullable | |
| `avg_faces` | float, nullable | Filled at end |
| `summary_json` | JSON, nullable | Filled at end |

### `samples`
| Column | Type | Notes |
|---|---|---|
| `id` | bigint, PK | |
| `session_id` | UUID, FK → sessions (cascade delete) | Indexed |
| `ts` | timestamp | |
| `faces` | int | |
| `class_scores_json` | JSON | The `aggregate.classes` object |
| `overall_label` | string, nullable | |

Samples are written at **1 row per second** per session (downsampled from the live stream).

### `SessionSummary` (returned on end)
```json
{
  "session_id": "uuid",
  "duration_s": 1834,
  "avg_faces": 3.2,
  "label_share": { "happy": 0.22, "neutral": 0.61, "sad": 0.05, "unhappy": 0.12 },
  "peak_tension": { "pct": 0.31, "at": "2026-09-29T14:52:10Z" }
}
```

## 8. Frontend Specification

- **Camera:** `getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })`. Show a clear error state for denied permission, no camera, or insecure context.
- **Consent gate:** modal before first camera start; the choice is remembered for the browser session only.
- **Capture loop (server mode):** draw the video to an offscreen canvas at `TARGET_FPS`, encode with `canvas.toBlob("image/jpeg", 0.7)`, send over the WebSocket. Skip a send if the previous frame's response has not arrived yet.
- **Dashboard elements:** live preview with boxes and labels, overall signal card, expression / positive / tension cards, seven-class bars, session timeline (History tab), Start/Stop controls, and the "camera on" indicator.
- **Disclaimer text (always visible):** "Facial expression is an observable signal, not a direct reading of internal emotion."
- **Edge mode toggle:** loads `@mediapipe/tasks-vision` and `onnxruntime-web` lazily, using WebGPU when available and WASM as fallback.

## 9. Performance Budget (server mode, per frame)

| Stage | Target |
|---|---|
| JPEG decode | 5 ms |
| BlazeFace detect | 10 ms |
| Crop and preprocess (per face) | 3 ms |
| Emotion inference (per face, CPU) | 25–40 ms |
| Track + smooth + aggregate | 2 ms |
| **Total for 4 faces** | **about 150–200 ms** (under the 300 ms goal) |

If the budget is exceeded, degrade in this order: reduce `TARGET_FPS`, reduce frame resolution, reduce `MAX_FACES`.

## 10. Security and Privacy Controls

- HTTPS/WSS only in production (browsers require a secure context for camera access).
- CORS restricted to `CORS_ORIGINS`; WebSocket `Origin` header is validated.
- Frame size limit and per-connection rate limit (drop frames above `TARGET_FPS × 2`).
- Session IDs are random UUIDs and must exist and be active to accept a socket.
- No images, embeddings, or identity data are persisted. Logs must not contain frame data.
- `DELETE /api/sessions/{id}` removes the session and its samples permanently.
- Consent notice before camera start; UI must state that everyone visible should be informed.
- Emotion recognition may be legally restricted in workplace and education contexts in some jurisdictions; deployment requires a local-law review.

## 11. Testing Plan

| Level | What | Tools |
|---|---|---|
| Unit | Label mapping, smoothing and hysteresis, IoU tracker, aggregation edge cases (0 faces, 1 face, many) | pytest |
| Component | Detector and classifier on a fixed set of labeled images (smiling, neutral, frowning, multiple faces, side profile, low light) | pytest with fixtures |
| API | REST routes, error codes, WebSocket happy path, oversized frame, ended session | pytest + httpx / Starlette test client |
| Performance | Latency and CPU with 1, 4 and 8 faces at target fps | Locust or custom script |
| Manual | Real meeting scenarios: lighting changes, glasses, masks, partial occlusion, two to six people | Checklist |

**Acceptance criteria:** face-detection recall of 90% or higher for faces within 2 m on the internal test set; fewer than 2 label changes per minute for a static expression; p95 latency under 300 ms with 4 faces; no image data present in the database or logs.

## 12. Deployment

- **Dockerfile:** Python slim base, install requirements, download models at build time, run `uvicorn backend.main:app --host 0.0.0.0 --port 8000`.
- **docker-compose:** `api` (FastAPI), `db` (Postgres, prod only), `web` (Nginx serving the built Vite `dist/` and reverse-proxying `/api` and `/ws`).
- **Nginx:** enable WebSocket upgrade headers on `/ws/`, TLS termination, gzip for static assets.
- **Health checks:** `/api/health` for the container orchestrator; the app refuses to report healthy until both models are loaded (load them in the FastAPI `lifespan` handler).
- **Workers:** run a single Uvicorn worker per CPU-bound inference instance to keep models loaded once; scale horizontally behind the proxy with sticky sessions for WebSockets.

## 13. Implementation Order

1. `ml/detector.py` + `ml/classifier.py` with a script that runs on a webcam and prints scores.
2. Tracker, smoothing, aggregation with unit tests.
3. FastAPI app: health, sessions REST, WebSocket live endpoint.
4. Frontend capture loop and dashboard wiring.
5. Session persistence, history view, export.
6. Edge mode, calibration baseline, performance tuning, Docker deployment.

## 14. Open Technical Questions

1. Is Short-Range BlazeFace sufficient for the expected group sizes and camera distances, or is Full-Range needed? Decide after the multi-face test in the component test suite.
2. Should Edge mode be the default to avoid streaming video to the server?
3. Should per-person calibration (neutral baseline) ship in v1 or v1.1?
4. Which database for production: Postgres, or SQLite for a single-node deployment?