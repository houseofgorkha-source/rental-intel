# Benchmark only: paddlepaddle 2.6.2 / paddleocr 2.7.3 (classic
# pre-PIR architecture) with MKLDNN explicitly enabled, timed over the
# same 14 tile crops the paddleocr 3.7.0 / mkldnn-disabled run used.
# Not wired into the Node pipeline — version-combo investigation only.
import sys
import time
from pathlib import Path

from paddleocr import PaddleOCR

CROPS_DIR = Path(__file__).resolve().parent.parent / ".data" / "benchmark_crops"

def main():
    print(f"paddleocr version check via import: {__import__('paddleocr').__file__}")
    t0 = time.time()
    ocr = PaddleOCR(use_angle_cls=False, lang="en", enable_mkldnn=True, show_log=False)
    print(f"[bench] model load: {time.time() - t0:.1f}s")

    files = sorted(CROPS_DIR.glob("*.jpg"))
    print(f"[bench] running OCR on {len(files)} crops (mkldnn=True)")

    total_start = time.time()
    per_tile = []
    for f in files:
        t0 = time.time()
        result = ocr.ocr(str(f), cls=False)
        elapsed = time.time() - t0
        per_tile.append(elapsed)
        lines = result[0] if result and result[0] else []
        texts = [(text, round(score, 3)) for _, (text, score) in lines] if lines else []
        print(f"  {f.name}: {elapsed:.2f}s  {texts}")

    total = time.time() - total_start
    print("")
    print(f"[bench] total OCR time for {len(files)} crops: {total:.1f}s")
    print(f"[bench] average per crop: {total / len(files):.2f}s")
    print(f"[bench] min/max per crop: {min(per_tile):.2f}s / {max(per_tile):.2f}s")

if __name__ == "__main__":
    main()
