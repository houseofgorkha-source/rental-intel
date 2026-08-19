# Benchmark only: paddlepaddle-gpu 3.2.2 (cu118) + paddleocr 3.7.0 on the
# GTX 1660 Ti, timed over the same 14 tile crops as the CPU/mkldnn-off
# baseline. Not wired into the Node pipeline — GPU feasibility check only.
import time
from pathlib import Path

from paddleocr import PaddleOCR

CROPS_DIR = Path(__file__).resolve().parent.parent / ".data" / "benchmark_crops"

def main():
    t0 = time.time()
    ocr = PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        device="gpu",
    )
    print(f"[bench-gpu] model load: {time.time() - t0:.1f}s")

    files = sorted(CROPS_DIR.glob("*.jpg"))
    print(f"[bench-gpu] running OCR on {len(files)} crops (device=gpu)")

    total_start = time.time()
    per_tile = []
    for f in files:
        t0 = time.time()
        result = ocr.predict(str(f))
        elapsed = time.time() - t0
        per_tile.append(elapsed)
        texts = []
        for res in result:
            for text, score in zip(res.get("rec_texts", []), res.get("rec_scores", [])):
                texts.append((text, round(float(score), 3)))
        print(f"  {f.name}: {elapsed:.2f}s  {texts}")

    total = time.time() - total_start
    print("")
    print(f"[bench-gpu] total OCR time for {len(files)} crops: {total:.1f}s")
    print(f"[bench-gpu] average per crop: {total / len(files):.2f}s")
    print(f"[bench-gpu] min/max per crop: {min(per_tile):.2f}s / {max(per_tile):.2f}s")

if __name__ == "__main__":
    main()
