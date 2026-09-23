// Busca os filmes da Barbie na TMDB (The Movie Database). A TMDB nao tem uma
// unica "collection" oficial reunindo os 40+ filmes (existem varias
// collections fragmentadas, tipo "Barbie Fairytopia Collection" e "Barbie
// Mariposa Collection"), entao a busca junta dois caminhos: texto ("Barbie")
// na busca normal de filmes, e as collections cujo nome bate com "Barbie"
// (pra pegar filme cujo titulo nao tem "Barbie" mas pertence a uma delas,
// tipo uma sub-serie derivada), sem depender de acertar um ID especifico.

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const MAX_PAGES = 5; // trava de seguranca: no maximo 5 paginas (ate 100 resultados)

// genreMap ({id: nome}) e' opcional - so' usado pra anexar movie.genres
// (estatisticas do Perfil). Sem ele, os filmes ainda funcionam normalmente,
// so' ficam sem genero conhecido.
export async function searchBarbieMovies(apiKey, fetchImpl = fetch, genreMap = {}) {
  const textResults = await searchByTitle(apiKey, fetchImpl, genreMap);
  const collectionResults = await searchByCollections(apiKey, fetchImpl, genreMap);

  const byId = new Map();
  for (const movie of [...textResults, ...collectionResults]) {
    byId.set(movie.id, movie);
  }
  return [...byId.values()].sort((a, b) => a.year - b.year);
}

async function searchByTitle(apiKey, fetchImpl, genreMap) {
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

  return normalizeMovies(allResults, { genreMap });
}

// Nunca deixa a busca inteira falhar por causa dessa parte extra: se a
// TMDB mudar algo aqui ou a chamada falhar, so' fica sem o reforco das
// collections (a busca por texto sozinha ja cobre a maioria dos filmes).
async function searchByCollections(apiKey, fetchImpl, genreMap) {
  try {
    const url = `${TMDB_BASE_URL}/search/collection?api_key=${encodeURIComponent(apiKey)}&query=Barbie&language=pt-BR`;
    const response = await fetchImpl(url);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    const collections = (data.results || []).filter(
      (collection) => collection.name && collection.name.toLowerCase().includes("barbie"),
    );

    const parts = await Promise.all(collections.map((collection) => fetchCollectionParts(collection.id, apiKey, fetchImpl)));
    // requireBarbieInTitle: false - a collection ja garante que o filme e'
    // da franquia, mesmo que o titulo individual nao tenha "Barbie".
    return normalizeMovies(parts.flat(), { requireBarbieInTitle: false, genreMap });
  } catch (error) {
    console.error("Nao foi possivel buscar por collection na TMDB:", error);
    return [];
  }
}

async function fetchCollectionParts(collectionId, apiKey, fetchImpl) {
  const url = `${TMDB_BASE_URL}/collection/${collectionId}?api_key=${encodeURIComponent(apiKey)}&language=pt-BR`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return Array.isArray(data.parts) ? data.parts : [];
}

// requireBarbieInTitle desligado so' faz sentido pra resultado que ja veio
// de uma collection da franquia (veja searchByCollections acima).
export function normalizeMovies(rawResults, { requireBarbieInTitle = true, genreMap = {} } = {}) {
  return rawResults
    .filter((movie) => movie.title && (!requireBarbieInTitle || movie.title.toLowerCase().includes("barbie")))
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
      releaseDate: movie.release_date || null,
      overview: movie.overview || "",
      posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null,
      genres: Array.isArray(movie.genre_ids) ? movie.genre_ids.map((id) => genreMap[id]).filter(Boolean) : [],
    }))
    .filter((movie) => movie.year !== null)
    .sort((a, b) => a.year - b.year);
}

// {id: nome} pra traduzir genre_ids em nome legivel nas estatisticas do
// Perfil. Endpoint publico da TMDB, nao muda com frequencia - dá pra
// cachear no cliente por bastante tempo (main.js cuida disso).
export async function fetchGenreMap(apiKey, fetchImpl = fetch) {
  const url = `${TMDB_BASE_URL}/genre/movie/list?api_key=${encodeURIComponent(apiKey)}&language=pt-BR`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Erro da TMDB: ${response.status}`);
  }
  const data = await response.json();
  const map = {};
  for (const genre of data.genres || []) {
    map[genre.id] = genre.name;
  }
  return map;
}

// Sinopse completa, duracao e elenco - so' buscado quando a pessoa abre a
// ficha de um filme (nao pros ~40 filmes de uma vez, que seria 40 chamadas
// extras so' pra listar a colecao).
export async function fetchMovieDetail(movieId, apiKey, fetchImpl = fetch) {
  const url = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${encodeURIComponent(apiKey)}&language=pt-BR&append_to_response=credits`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Erro da TMDB: ${response.status}`);
  }
  const data = await response.json();
  const cast = data.credits && Array.isArray(data.credits.cast) ? data.credits.cast.slice(0, 5).map((person) => person.name) : [];
  return {
    overview: data.overview || "",
    runtime: typeof data.runtime === "number" && data.runtime > 0 ? data.runtime : null,
    cast,
  };
}
