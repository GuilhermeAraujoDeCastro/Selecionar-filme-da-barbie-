// Proxy da TMDB pro navegador: o site chama /api/tmdb?caminho=/search/movie&query=... e a chave
// (TMDB_API_KEY nas variaveis da Vercel) entra aqui, no servidor. So' os caminhos que o site usa passam.
const PERMITIDOS = [
  /^\/discover\/movie$/,
  /^\/search\/movie$/,
  /^\/search\/collection$/,
  /^\/collection\/\d+$/,
  /^\/genre\/movie\/list$/,
  /^\/movie\/\d+$/,
];

export default async function handler(request, response) {
  const chave = process.env.TMDB_API_KEY;
  if (!chave) {
    response.status(500).json({ error: "TMDB_API_KEY nao configurada nas variaveis de ambiente da Vercel." });
    return;
  }
  const params = new URL(request.url, "http://localhost").searchParams;
  const caminho = params.get("caminho") || "";
  if (!PERMITIDOS.some((regra) => regra.test(caminho))) {
    response.status(400).json({ error: "Caminho nao permitido." });
    return;
  }
  params.delete("caminho");
  params.set("api_key", chave);
  try {
    const resposta = await fetch(`https://api.themoviedb.org/3${caminho}?${params}`);
    const corpo = await resposta.text();
    if (resposta.ok) {
      // Catalogo muda pouco: a CDN da Vercel guarda 6 horas e poupa a cota da TMDB.
      response.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    }
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.status(resposta.status).send(corpo);
  } catch {
    response.status(502).json({ error: "Nao deu pra falar com a TMDB agora." });
  }
}
