"""
Export the trained landslide GBDT pipeline to ONNX for in-browser inference.

Output: public/model.onnx
  input : float32 [1, 9]  — FEATURES order (rain_1d..month_cos)
  output: float32 [1, 1]  — P(class = 1)  (landslide probability)

Run AFTER `python -m app.train_model` inside ml-service/.
"""

import json
import os
import sys

import numpy as np
import onnxruntime as ort
import joblib
from skl2onnx import to_onnx
from skl2onnx.common.data_types import FloatTensorType

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
MODEL = os.path.join(ROOT, "ml-service", "app", "model.joblib")
META = os.path.join(ROOT, "ml-service", "app", "model_meta.json")
OUT = os.path.join(ROOT, "public", "model.onnx")

N_FEATURES = 9


def main():
    pipe = joblib.load(MODEL)
    print("Loaded", MODEL)

    # initial_types uses a dummy classifier name; to_onnx on the pipeline
    # produces [N, C] label+probabilities — we keep prob[:, 1] via post-processing
    onnx_model = to_onnx(
        pipe,
        initial_types=[("input", FloatTensorType([None, N_FEATURES]))],
        options={id(pipe): {"zipmap": False}},
        target_opset=17,
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"Wrote {OUT} ({os.path.getsize(OUT)} bytes)")

    # --- validation against sklearn ---
    rng = np.random.default_rng(0)
    X = rng.uniform(0, 1, size=(400, N_FEATURES)).astype(np.float32)
    X[:, 5] *= 4000          # elevation_m
    X[:, 6] *= 60            # slope_deg
    X[:, 7] = np.sin(X[:, 7] * 2 * np.pi)
    X[:, 8] = np.cos(X[:, 8] * 2 * np.pi)

    sess = ort.InferenceSession(OUT, providers=["CPUExecutionProvider"])
    out_names = [o.name for o in sess.get_outputs()]
    print("onnx outputs:", out_names)
    res = sess.run(None, {sess.get_inputs()[0].name: X})

    probs_onnx = np.asarray(res[-1], dtype=np.float64)
    if probs_onnx.ndim == 2 and probs_onnx.shape[1] >= 2:
        probs_onnx = probs_onnx[:, 1]
    probs_sk = pipe.predict_proba(X)[:, 1]

    err = float(np.max(np.abs(probs_onnx - probs_sk)))
    print(f"max |onnx - sklearn| = {err:.2e}")
    if err > 1e-4:
        print("WARNING: ONNX deviates from sklearn beyond 1e-4")
        sys.exit(1)

    meta = {}
    if os.path.exists(META):
        with open(META, "r", encoding="utf-8") as f:
            meta = json.load(f)
    meta["onnx"] = {
        "path": "public/model.onnx",
        "features": meta.get("features"),
        "max_abs_error_vs_sklearn": err,
        "input": "float32 [1,9]",
        "output": "float32 [1,1] = P(landslide)",
    }
    with open(META, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print("Validation OK — ONNX matches sklearn.")


if __name__ == "__main__":
    main()
