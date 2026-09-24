// Ultimo passo do build na Vercel: minifica HTML, JS, CSS e o service worker.
// Deixa o F12 dificil de ler; o codigo legivel continua so no repositorio.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { minify } from "terser";
import CleanCSS from "clean-css";
import { minify as minifyHtml } from "html-minifier-terser";

// Lista os modulos sozinho pra nao esquecer arquivo novo.
const arquivosJs = readdirSync("js")
  .filter((nome) => nome.endsWith(".js") && nome !== "config.example.js")
  .map((nome) => `js/${nome}`);

const arquivosCss = ["css/styles.css"];

try {
  for (const caminho of arquivosJs) {
    const codigo = readFileSync(caminho, "utf8");
    // module: true preserva import/export entre os arquivos.
    const resultado = await minify(codigo, { module: true, mangle: true, compress: true });
    writeFileSync(caminho, resultado.code);
  }

  // Id unico por deploy no nome do cache do service worker (forca a atualizacao).
  const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 10);
  const swCodigo = readFileSync("sw.js", "utf8").replaceAll("__BUILD_ID__", buildId);
  // Service worker e script classico (sem import/export).
  const sw = await minify(swCodigo, { mangle: true, compress: true });
  writeFileSync("sw.js", sw.code);

  for (const caminho of arquivosCss) {
    const resultado = new CleanCSS().minify(readFileSync(caminho, "utf8"));
    if (resultado.errors.length > 0) {
      throw new Error(resultado.errors.join("; "));
    }
    writeFileSync(caminho, resultado.styles);
  }

  // HTML sem comentarios nem espacos; o script inline do tema tambem e minificado.
  const html = await minifyHtml(readFileSync("index.html", "utf8"), {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true,
    minifyJS: true,
    minifyCSS: true,
  });
  writeFileSync("index.html", html);

  console.log(`HTML, sw.js, ${arquivosJs.length} arquivos JS e CSS minificados.`);
} catch (error) {
  console.error("Erro ao minificar:", error);
  process.exit(1);
}
