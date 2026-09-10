// Busca os filmes da Barbie na TMDB (The Movie Database). A TMDB nao tem uma
// unica "collection" oficial reunindo os 40+ filmes (conferi: existem varias
// collections fragmentadas, tipo "Barbie Fairytopia Collection" e "Barbie
// Mariposa Collection", cada uma so' com uma sub-serie), entao em vez de
// depender de um ID de collection especifico, busca por texto ("Barbie") na
// busca de filmes normal e filtra o resultado.

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const MAX_PAGES = 5; // trava de seguranca: no maximo 5 paginas (ate 100 resultados)

export async function searchBarbieMovies(apiKey, fetchImpl = fetch) {
  const allResults = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = `${TMDB_BASE_URL}/search/movie?api_key=${encodeURIComponent(apiKey)}&query=Barbie&language=pt-BR&include_adult=false&page=${page}`;
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`Erro da TMDB: ${response.status}`);
    }
    const data = await response.json();
    allResults.push(...(data.results || []));
    totalPages = data.total_pages || 1;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES);

  return normalizeMovies(allResults);
}

export function normalizeMovies(rawResults) {
  return rawResults
    .filter((movie) => movie.title && movie.title.toLowerCase().includes("barbie"))
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
      overview: movie.overview || "",
      posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null,
    }))
    .filter((movie) => movie.year !== null)
    .sort((a, b) => a.year - b.year);
}
