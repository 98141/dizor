// Resuelve el alias "@/..." a frontend/src y trata los .js del frontend
// como ESM, para importar módulos de lib/ sin compilar la app.
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const SRC = process.env.DIZOR_FRONTEND_SRC;

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    let p = path.join(SRC, specifier.slice(2));
    if (!path.extname(p)) {
      for (const ext of [".js", ".jsx"]) if (fs.existsSync(p + ext)) { p += ext; break; }
    }
    return next(pathToFileURL(p).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.includes("/frontend/src/") && !path.extname(specifier)) {
    return next(`${specifier}.js`, context);
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.includes("/frontend/src/") && url.endsWith(".js")) {
    const source = fs.readFileSync(new URL(url), "utf8");
    return { format: "module", source, shortCircuit: true };
  }
  return next(url, context);
}
