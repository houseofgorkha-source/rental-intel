# OCR-engine comparison only: run PaddleOCR on the exact same
# zoomed.jpg produced by the positive-control de-warp test, and compare
# against the best Tesseract result. No new API calls (reads a local
# file only). Not wired into the Node pipeline.
import json
from pathlib import Path

from paddleocr import PaddleOCR

IMAGE_PATH = Path(__file__).resolve().parent.parent / ".data" / "positive_control" / "zoomed.jpg"
TARGETS = ["jute tree", "honey gold", "superserv"]

def main():
    print(f"[paddle] image: {IMAGE_PATH}")
    ocr = PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        enable_mkldnn=False,
    )
    result = ocr.predict(str(IMAGE_PATH))

    lines = []
    for res in result:
        texts = res.get("rec_texts", [])
        scores = res.get("rec_scores", [])
        for text, score in zip(texts, scores):
            lines.append((text, score))

    lines.sort(key=lambda t: t[1], reverse=True)
    print(f"[paddle] detected {len(lines)} text lines")
    for text, score in lines:
        print(f"  conf={score:.3f}  text={text!r}")

    joined = " ".join(t.lower() for t, _ in lines)
    print("")
    print("[paddle] target check:")
    found_any = False
    for target in TARGETS:
        found = target in joined
        found_any = found_any or found
        print(f"  {'FOUND' if found else 'not found'}: {target!r}")

    print("")
    print(f"[paddle] any target matched: {found_any}")

if __name__ == "__main__":
    main()
