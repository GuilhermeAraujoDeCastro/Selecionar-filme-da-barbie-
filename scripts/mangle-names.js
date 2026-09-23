// Passo opcional de build (roda na Vercel, depois do generate-config.js e
// antes do minify.js): troca os id/class do HTML/CSS/JS publicados por
// nomes curtos sem sentido (tipo "a" em vez de "movie-grid"), so' pra
// deixar o F12 um pouco menos confortavel de ler. E' tao cosmetico quanto
// a minificacao (veja minify.js): quem quiser entender a estrutura ainda
// consegue, so' fica um pouco mais chato. O codigo-fonte no repositorio
// continua com os nomes de verdade; so' a copia publicada na Vercel fica
// assim.
//
// Os nomes sao descobertos sozinhos (varre index.html/css/styles.css/js/*)
// em vez de manter uma lista fixa a mao - o projeto cresceu bastante desde
// a 1a versao deste script, e uma lista fixa vivia ficando desatualizada
// (um id/class novo simplesmente nao era trocado, sem nenhum aviso). Um
// nome que nao aparecer em nenhum lugar reconhecido aqui embaixo
// simplesmente fica sem o disfarce (nunca quebra, so' fica menos ofuscado).

import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const htmlPath = "index.html";
const cssPath = "css/styles.css";
const jsFiles = readdirSync("js")
  .filter((name) => name.endsWith(".js") && name !== "config.example.js")
  .map((name) => `js/${name}`);

const html = readFileSync(htmlPath, "utf8");
const css = readFileSync(cssPath, "utf8");
const jsSources = Object.fromEntries(jsFiles.map((path) => [path, readFileSync(path, "utf8")]));

// O unico lugar com classe montada em template literal (a estrela cheia) -
// tem aspas dentro do ${...}, o que confundiria qualquer regex generica de
// class="..." (tanto pra descobrir quanto pra trocar). Por isso e' tratado
// a parte, com um "throw" se o padrao nao bater mais - pra nunca publicar
// quebrado se esse trecho mudar no futuro sem atualizar aqui tambem.
const STAR_TEMPLATE = 'class="star${value <= rating ? " filled" : ""}"';
if (!jsSources["js/main.js"] || !jsSources["js/main.js"].includes(STAR_TEMPLATE)) {
  throw new Error("mangle-names: padrao da estrela nao encontrado em js/main.js (o arquivo mudou?) — abortando pra nao publicar quebrado.");
}

// ---------- descoberta dos nomes usados ----------

function collectInto(set, regex, text) {
  for (const match of text.matchAll(regex)) {
    set.add(match[1]);
  }
}

const idNames = new Set();
const classNames = new Set(["star", "filled"]); // vem do STAR_TEMPLATE acima, nao de regex

collectInto(idNames, /\bid="([^"]+)"/g, html);
collectInto(idNames, /\bfor="([^"]+)"/g, html);
collectInto(idNames, /\baria-controls="([^"]+)"/g, html);
collectInto(idNames, /\baria-labelledby="([^"]+)"/g, html);

for (const match of html.matchAll(/\bclass="([^"]+)"/g)) {
  match[1].split(/\s+/).filter(Boolean).forEach((name) => classNames.add(name));
}

// So' existe seletor por classe nesse projeto (nenhum "#id" no CSS, so'
// cores hexadecimais tipo #e0218a) - por isso so' varre ".nome". O "." tem
// que vir seguido de letra, senao pegaria numero decimal tipo "0.15s".
collectInto(classNames, /\.([a-zA-Z][\w-]*)/g, css);

for (const source of Object.values(jsSources)) {
  collectInto(idNames, /getElementById\("([^"]+)"\)/g, source);
  collectInto(classNames, /querySelectorAll\("\.([a-zA-Z][\w-]*)"\)/g, source);
  collectInto(classNames, /\.matches\("\.([a-zA-Z][\w-]*)"\)/g, source);
  collectInto(classNames, /\.closest\("\.([a-zA-Z][\w-]*)"\)/g, source);
  collectInto(classNames, /classList\.(?:add|toggle|remove|contains)\("([a-zA-Z][\w-]*)"/g, source);
}

// ---------- monta os mapas (nome -> codigo curto) ----------

// Gera "a", "b", ..., "z", "aa", "ab", ... na ordem do indice (mesma logica
// de nomear coluna de planilha). Curto, sem sentido, nunca repete. A ordem
// alfabetica dos nomes so' garante que o resultado seja igual toda vez que
// o build roda com o mesmo conjunto de nomes.
function shortCode(index) {
  let n = index;
  let code = "";
  do {
    code = String.fromCharCode(97 + (n % 26)) + code;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return code;
}

function buildMap(names) {
  const map = {};
  [...names].sort().forEach((name, i) => {
    map[name] = shortCode(i);
  });
  return map;
}

const ID_MAP = buildMap(idNames);
const CLASS_MAP = buildMap(classNames);

// ---------- aplica a troca ----------

// "a b c" -> mapeia cada classe da lista separadamente (um elemento pode
// ter mais de uma classe) e devolve remontado com espaco.
function mapClassList(list) {
  return list
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => CLASS_MAP[token] || token)
    .join(" ");
}

function mangleHtmlLike(text) {
  return text
    .replace(/\bid="([^"]+)"/g, (full, name) => `id="${ID_MAP[name] || name}"`)
    .replace(/\bfor="([^"]+)"/g, (full, name) => `for="${ID_MAP[name] || name}"`)
    .replace(/\baria-controls="([^"]+)"/g, (full, name) => `aria-controls="${ID_MAP[name] || name}"`)
    .replace(/\baria-labelledby="([^"]+)"/g, (full, name) => `aria-labelledby="${ID_MAP[name] || name}"`)
    .replace(/\bclass="([^"]+)"/g, (full, list) => `class="${mapClassList(list)}"`);
}

function mangleCss(text) {
  return text.replace(/\.([a-zA-Z][\w-]*)/g, (full, name) => `.${CLASS_MAP[name] || name}`);
}

// getElementById fica de fora aqui de proposito (so' id="..." do HTML
// estatico e' trocado - um id só criado dentro de um template literal do
// JS, como o da textarea de resenha, ficaria seguro mas exigiria cuidado
// extra pra nao confundir com atributos tipo "data-movie-id"; nao vale a
// pena pra um ganho tao cosmetico).
function mangleJs(text) {
  const STAR_MARKER = "@@MANGLE_STAR@@";
  const starReplacement = `class="${CLASS_MAP.star}\${value <= rating ? " ${CLASS_MAP.filled}" : ""}"`;

  let out = text.split(STAR_TEMPLATE).join(STAR_MARKER);

  out = out
    .replace(/getElementById\("([^"]+)"\)/g, (full, name) => `getElementById("${ID_MAP[name] || name}")`)
    .replace(/querySelectorAll\("\.([a-zA-Z][\w-]*)"\)/g, (full, name) => `querySelectorAll(".${CLASS_MAP[name] || name}")`)
    .replace(/\.matches\("\.([a-zA-Z][\w-]*)"\)/g, (full, name) => `.matches(".${CLASS_MAP[name] || name}")`)
    .replace(/\.closest\("\.([a-zA-Z][\w-]*)"\)/g, (full, name) => `.closest(".${CLASS_MAP[name] || name}")`)
    .replace(
      /classList\.(add|toggle|remove|contains)\("([a-zA-Z][\w-]*)"/g,
      (full, method, name) => `classList.${method}("${CLASS_MAP[name] || name}"`,
    )
    .replace(/\bclass="([^"]+)"/g, (full, list) => `class="${mapClassList(list)}"`);

  return out.split(STAR_MARKER).join(starReplacement);
}

try {
  writeFileSync(htmlPath, mangleHtmlLike(html));
  writeFileSync(cssPath, mangleCss(css));
  for (const path of jsFiles) {
    writeFileSync(path, mangleJs(jsSources[path]));
  }
  console.log(
    `id/class trocados por nomes curtos em index.html, css/styles.css e ${jsFiles.length} arquivo(s) JS (so' estetico, mesma ideia da minificacao).`,
  );
} catch (error) {
  console.error("Erro ao trocar id/class:", error);
  process.exit(1);
}
