import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { ReadFile } from "../application/ports.js";

export const dataFileReader =
  (dataDir: string): ReadFile =>
  (path) => {
    const full = resolve(dataDir, path);
    const rel = relative(resolve(dataDir), full);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
      return Promise.reject(Object.assign(new Error("path must be inside the data folder"), { status: 400 }));
    }
    return readFile(full, "utf8");
  };
