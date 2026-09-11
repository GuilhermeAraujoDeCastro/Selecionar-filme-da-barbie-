// Passo opcional de build (roda na Vercel, depois do generate-config.js):
// minifica os arquivos JS e CSS que vao pro navegador (remove comentarios,
// espacos e da nomes curtos pras variaveis internas de cada funcao), so pra
// nao deixar o codigo tao confortavel de ler no F12. Isso e so estetica: nao
// e e nao substitui protecao de verdade, isso ja e feito por outro motivo
// (a chave da TMDB e o config do Firebase sao publicos por design; nenhum
// segredo de verdade passa por este arquivo). O codigo-fonte legivel
// continua normal no repositorio, so a copia publicada fica assim.
import { readFileSync, writeFileSync } from "node:fs";
import { minify } from "terser";
import CleanCSS from "clean-css";

const arquivosJs = [
  "js/main.js",
  "js/progress.js",
  "js/filters.js",
  "js/ratings.js",
  "js/tmdb.js",
  "js/storage-local.js",
  "js/firebase-app.js",
  "js/config.js",
];

const arquivosCss = ["css/styles.css"];

try {
  for (const caminho of arquivosJs) {
    const codigo = readFileSync(caminho, "utf8");
    // module: true preserva os nomes de import/export; mangle so renomeia
    // variaveis locais dentro de cada funcao, nunca o que outro arquivo importa.
    const resultado = await minify(codigo, { module: true, mangle: true, compress: true });
    writeFileSync(caminho, resultado.code);
  }

  for (const caminho of arquivosCss) {
    const codigo = readFileSync(caminho, "utf8");
    const resultado = new CleanCSS().minify(codigo);
    if (resultado.errors.length > 0) {
      throw new Error(resultado.errors.join("; "));
    }
    writeFileSync(caminho, resultado.styles);
  }

  console.log("JS e CSS minificados pra publicacao (so estetico, nao protege nada por si so).");
} catch (error) {
  console.error("Erro ao minificar:", error);
  process.exit(1);
}
