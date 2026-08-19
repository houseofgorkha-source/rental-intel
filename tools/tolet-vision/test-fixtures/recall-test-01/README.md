# Recall test 1 — real board detection

Evidence for the first successful recall test of the production pipeline
(`src/runExperimentPaddle.js`, GPU PaddleOCR): a genuine physical "TO-LET"
board, found by manually scanning Street View panoramas near Ambalipura/
Haralur Road, correctly detected and scored by the unchanged pipeline.

- `panorama.jpg` — the full equirectangular Street View panorama containing
  the board (Ola imageId `fc6a05843374700314227997fb9be243`,
  12.900499, 77.648649).
- `detected_crop.jpg` — the exact 1024x1024 tile the pipeline scored as a
  candidate, showing the "TO-LET" stickers on the pole.
- `result.json` — the pipeline's candidate output for this panorama plus
  run provenance (engine, thresholds, crop counts).

The board reads "TO-LET / 1,2,3 BHK -RK / 7019164269". The pipeline
correctly extracted the phone number (`7019164269`) and the TO_LET signal.
It did not extract a BHK value — the regex expects a number immediately
before "BHK" (e.g. "2 BHK"), not "1,2,3 BHK" — a known, not-yet-fixed gap,
left as-is per instruction not to modify scoring in this commit.
