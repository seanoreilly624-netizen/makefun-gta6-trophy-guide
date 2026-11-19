/* Leonida Trophy Guide — entrypoint.
 *
 * Copies the guide (app/) and its screenshots (screenshots/) from this
 * repository into the output directory, then asks the vendored
 * make.fun library to write output dossier.json from what was copied.
 * Node 22, standard library only. */

import { buildDossier } from "./vendor/makefun-frontend.ts";
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots_max: 4,
  screenshot_max_bytes: 262144,
  app_max_files: 993,
  app_max_bytes: 50331648,
};

function repoRoot() {
  return dirname(fileURLToPath(import.meta.url));
}

function outputDirectory() {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.length > 0) return resolve(process.cwd(), fromEnv);
  return "/output";
}

function wipeDirectory(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

function copyTree(source, target) {
  if (!existsSync(source)) throw new Error("Missing input directory: " + source);
  cpSync(source, target, { recursive: true });
}

function handedDossierIsWritten(outDir) {
  const dossierPath = join(outDir, "dossier.json");
  return existsSync(dossierPath) && statSync(dossierPath).isFile();
}

async function main() {
  const root = repoRoot();
  const outDir = outputDirectory();
  wipeDirectory(outDir);
  copyTree(join(root, "app"), join(outDir, "app"));
  copyTree(join(root, "screenshots"), join(outDir, "screenshots"));

  const built = await buildDossier(outDir, DOSSIER_LIMITS);
  const dossierPath = join(outDir, "dossier.json");

  if (typeof built === "string") {
    writeFileSync(dossierPath, built, "utf8");
  } else if (built instanceof Uint8Array) {
    /* buildDossier hands back the dossier's exact bytes; write them raw
       so the file matches the library's output byte for byte. */
    writeFileSync(dossierPath, built);
  } else if (built !== null && typeof built === "object" && !handedDossierIsWritten(outDir)) {
    writeFileSync(dossierPath, JSON.stringify(built, null, 2) + "\n", "utf8");
  } else if (!handedDossierIsWritten(outDir)) {
    throw new Error("buildDossier returned nothing and wrote no dossier.json");
  }

  const dossierSize = statSync(dossierPath).size;
  console.log("Wrote " + dossierPath + " (" + dossierSize + " bytes)");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
