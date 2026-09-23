import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchGenreMap, fetchMovieDetail, normalizeMovies, searchBarbieMovies } from "../js/tmdb.js";

// Por padrao neutraliza os endpoints de collection (resultado vazio), pra
// nao afetar os testes que so' se importam com a busca por texto.
function fakeFetch(responsesByPage) {
  return async (url) => {
    if (url.includes("/search/collection")) {
      return { ok: true, status: 200, json: async () => ({ results: [] }) };
    }
    if (url.includes("/collection/")) {
      return { ok: true, status: 200, json: async () => ({ parts: [] }) };
    }
    const pageMatch = url.match(/page=(\d+)/);
    const page = pageMatch ? Number(pageMatch[1]) : 1;
    const body = responsesByPage[page];
    return {
      ok: true,
      status: 200,
      json: async () => body,
    };
  };
}

test("normalizeMovies keeps only titles that actually contain 'Barbie'", () => {
  const raw = [
    { id: 1, title: "Barbie in the Nutcracker", release_date: "2001-10-16" },
    { id: 2, title: "Totally Unrelated Movie", release_date: "2010-01-01" },
  ];
  const result = normalizeMovies(raw);
  assert.deepEqual(result.map((m) => m.id), [1]);
});

test("normalizeMovies discards entries without a release date", () => {
  const raw = [{ id: 1, title: "Barbie: Upcoming", release_date: "" }];
  assert.deepEqual(normalizeMovies(raw), []);
});

test("normalizeMovies extracts the year and builds the full poster URL", () => {
  const raw = [{ id: 1, title: "Barbie as Rapunzel", release_date: "2002-10-08", poster_path: "/abc.jpg" }];
  const [movie] = normalizeMovies(raw);
  assert.equal(movie.year, 2002);
  assert.equal(movie.posterPath, "https://image.tmdb.org/t/p/w342/abc.jpg");
});

test("normalizeMovies sorts by release year", () => {
  const raw = [
    { id: 1, title: "Barbie B", release_date: "2015-01-01" },
    { id: 2, title: "Barbie A", release_date: "2001-01-01" },
  ];
  const result = normalizeMovies(raw);
  assert.deepEqual(result.map((m) => m.id), [2, 1]);
});

test("searchBarbieMovies fetches every page reported by the API", async () => {
  const fetchImpl = fakeFetch({
    1: {
      results: [{ id: 1, title: "Barbie Filme 1", release_date: "2001-01-01" }],
      total_pages: 2,
    },
    2: {
      results: [{ id: 2, title: "Barbie Filme 2", release_date: "2002-01-01" }],
      total_pages: 2,
    },
  });

  const movies = await searchBarbieMovies("chave-fake", fetchImpl);

  assert.equal(movies.length, 2);
  assert.deepEqual(movies.map((m) => m.id), [1, 2]);
});

test("searchBarbieMovies stops after the safety cap even if the API reports more pages", async () => {
  const responsesByPage = {};
  for (let page = 1; page <= 10; page += 1) {
    responsesByPage[page] = {
      results: [{ id: page, title: `Barbie Filme ${page}`, release_date: `20${10 + page}-01-01` }],
      total_pages: 10,
    };
  }
  const fetchImpl = fakeFetch(responsesByPage);

  const movies = await searchBarbieMovies("chave-fake", fetchImpl);

  assert.equal(movies.length, 5); // MAX_PAGES = 5
});

test("searchBarbieMovies throws a clear error on HTTP failure", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });

  await assert.rejects(() => searchBarbieMovies("chave-invalida", fetchImpl), /401/);
});

test("normalizeMovies with requireBarbieInTitle:false keeps a title without 'Barbie'", () => {
  const raw = [{ id: 1, title: "Life in the Dreamhouse: A Netflix Special", release_date: "2023-01-01" }];
  const result = normalizeMovies(raw, { requireBarbieInTitle: false });
  assert.deepEqual(result.map((m) => m.id), [1]);
});

test("normalizeMovies attaches genre names from the genre map", () => {
  const raw = [{ id: 1, title: "Barbie", release_date: "2023-07-21", genre_ids: [35, 14, 999] }];
  const [movie] = normalizeMovies(raw, { genreMap: { 35: "Comedia", 14: "Fantasia" } });
  assert.deepEqual(movie.genres, ["Comedia", "Fantasia"]); // 999 nao existe no mapa, e' descartado
});

test("searchBarbieMovies merges collection parts that the text search missed", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/search/collection")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: [{ id: 99, name: "Barbie Fairytopia Collection" }] }),
      };
    }
    if (url.includes("/collection/99")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          parts: [{ id: 2, title: "Mariposa", release_date: "2007-01-01" }],
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ id: 1, title: "Barbie Filme 1", release_date: "2001-01-01" }],
        total_pages: 1,
      }),
    };
  };

  const movies = await searchBarbieMovies("chave-fake", fetchImpl);
  assert.deepEqual(
    movies.map((m) => m.id),
    [1, 2],
  );
});

test("searchBarbieMovies dedupes a movie present in both the text search and a collection", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/search/collection")) {
      return { ok: true, status: 200, json: async () => ({ results: [{ id: 99, name: "Barbie Collection" }] }) };
    }
    if (url.includes("/collection/99")) {
      return { ok: true, status: 200, json: async () => ({ parts: [{ id: 1, title: "Barbie Filme 1", release_date: "2001-01-01" }] }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: 1, title: "Barbie Filme 1", release_date: "2001-01-01" }], total_pages: 1 }),
    };
  };

  const movies = await searchBarbieMovies("chave-fake", fetchImpl);
  assert.equal(movies.length, 1);
});

test("searchBarbieMovies ignores a collection search failure instead of throwing", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/search/collection")) {
      throw new Error("network down");
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: 1, title: "Barbie Filme 1", release_date: "2001-01-01" }], total_pages: 1 }),
    };
  };

  const movies = await searchBarbieMovies("chave-fake", fetchImpl);
  assert.deepEqual(movies.map((m) => m.id), [1]);
});

test("fetchGenreMap builds an id -> name map", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ genres: [{ id: 35, name: "Comedia" }, { id: 14, name: "Fantasia" }] }),
  });
  const map = await fetchGenreMap("chave-fake", fetchImpl);
  assert.deepEqual(map, { 35: "Comedia", 14: "Fantasia" });
});

test("fetchMovieDetail returns overview, runtime and up to 5 cast names", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      overview: "Uma boneca descobre o mundo real.",
      runtime: 114,
      credits: { cast: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "E" }, { name: "F" }] },
    }),
  });
  const detail = await fetchMovieDetail(1, "chave-fake", fetchImpl);
  assert.equal(detail.overview, "Uma boneca descobre o mundo real.");
  assert.equal(detail.runtime, 114);
  assert.deepEqual(detail.cast, ["A", "B", "C", "D", "E"]);
});

test("fetchMovieDetail throws a clear error on HTTP failure", async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(() => fetchMovieDetail(1, "chave-fake", fetchImpl), /404/);
});
