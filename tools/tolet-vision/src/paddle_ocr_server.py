# Persistent PaddleOCR worker process, driven over stdin/stdout by
# src/paddleOcrEngine.js. One process, many requests — model load is
# slow (~10s), so a fresh process per crop would dominate runtime.
#
# Protocol: one JSON object per line on stdin: {"id": <int>, "path": <str>}
# Responds with one JSON object per line on stdout:
#   {"id": <int>, "lines": [{"text": <str>, "confidence": <float 0..1>}, ...]}
# Prints {"ready": true} once models are loaded, before reading requests.
import sys
import json

from paddleocr import PaddleOCR


def main():
    # Validated in the GPU feasibility benchmark: paddlepaddle-gpu 3.2.2
    # (cu118) on this machine's GTX 1660 Ti, ~57x faster than CPU/mkldnn-off
    # on the same 14-crop panorama (155.0s -> 2.7s). Run via .venv-gpu's
    # interpreter (see VENV_PYTHON in paddleOcrEngine.js), not .venv.
    ocr = PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        device="gpu",
    )
    print(json.dumps({"ready": True}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req = json.loads(line)
        try:
            result = ocr.predict(req["path"])
            lines = []
            for res in result:
                texts = res.get("rec_texts", [])
                scores = res.get("rec_scores", [])
                for text, score in zip(texts, scores):
                    lines.append({"text": text, "confidence": float(score)})
            print(json.dumps({"id": req["id"], "lines": lines}), flush=True)
        except Exception as e:
            print(json.dumps({"id": req["id"], "error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
