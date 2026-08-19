// Node bridge to the persistent PaddleOCR Python process
// (paddle_ocr_server.py). Exposes the same shape ocrPipeline.js already
// expects from a Tesseract worker — `{ recognize(buffer) -> Promise<{data:
// {text, confidence}}>, terminate() }` — so ocrPipeline.js's tiling logic
// does not need to change to use this instead of Tesseract.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// .venv-gpu: paddlepaddle-gpu 3.2.2 (cu118), validated against this
// machine's GTX 1660 Ti — ~57x faster than the CPU/mkldnn-off .venv on
// the same benchmark (155.0s -> 2.7s for 14 crops).
const VENV_PYTHON = path.resolve(import.meta.dirname, "..", ".venv-gpu", "Scripts", "python.exe");
const SERVER_SCRIPT = path.resolve(import.meta.dirname, "paddle_ocr_server.py");
const TMP_DIR = path.join(os.tmpdir(), "tolet-vision-paddle-ocr");

export async function withPaddleOcrWorker(fn) {
  const worker = await createPaddleOcrWorker();
  try {
    return await fn(worker);
  } finally {
    await worker.terminate();
  }
}

export async function createPaddleOcrWorker() {
  await mkdir(TMP_DIR, { recursive: true });

  const child = spawn(VENV_PYTHON, [SERVER_SCRIPT], { stdio: ["pipe", "pipe", "inherit"] });
  const rl = createInterface({ input: child.stdout });

  const pending = new Map();
  let nextId = 0;
  let ready;
  const readyPromise = new Promise((resolve) => {
    ready = resolve;
  });

  rl.on("line", (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // stray non-JSON output; ignore
    }
    if (msg.ready) {
      ready();
      return;
    }
    const resolver = pending.get(msg.id);
    if (resolver) {
      pending.delete(msg.id);
      resolver(msg);
    }
  });

  child.on("exit", (code) => {
    for (const resolver of pending.values()) {
      resolver({ error: `paddle_ocr_server.py exited (code ${code}) before responding` });
    }
    pending.clear();
  });

  await readyPromise;

  return {
    async recognize(buffer) {
      const id = nextId++;
      const filePath = path.join(TMP_DIR, `crop_${id}.jpg`);
      await writeFile(filePath, buffer);

      const responsePromise = new Promise((resolve) => pending.set(id, resolve));
      child.stdin.write(JSON.stringify({ id, path: filePath }) + "\n");
      const msg = await responsePromise;

      await unlink(filePath).catch(() => {});

      if (msg.error) {
        console.warn(`[paddleOcrEngine] recognize error: ${msg.error}`);
        return { data: { text: "", confidence: 0 } };
      }

      const lines = msg.lines ?? [];
      const text = lines.map((l) => l.text).join("\n");
      // Tesseract's confidence scale is 0-100; PaddleOCR's rec_scores are
      // 0-1. Scale to match so the existing OCR_CONFIDENCE_FLOOR (tuned
      // against Tesseract's scale) means the same thing here.
      const confidence = lines.length ? Math.min(...lines.map((l) => l.confidence)) * 100 : 0;

      return { data: { text, confidence, lines } };
    },
    async terminate() {
      child.stdin.end();
      child.kill();
    },
  };
}
