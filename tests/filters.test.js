import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableYears,
  filterMovies,
  isCompleted,
  isMovieUpcoming,
  sortMoviesAlphabetically,
  sortMoviesByRating,
  sortMoviesByYear,
  splitByCompletion,
  splitUpcoming,
} from "../js/filters.js";

const MOVIES = [
  { id: 1, title: "Barbie e as Doze Princesas Bailarinas", year: 2006 },
  { id: 2, title: "Barbie no Lago dos Cisnes", year: 2003 },
  { id: 3, title: "Barbie: A Journey Through Time", year: 2024 },
];

test("filterMovies by year keeps only that year", () => {
  const result = filterMovies(MOVIES, { year: 2003 });
  assert.deepEqual(result.map((m) => m.id), [2]);
});

test("filterMovies onlyUnwatched excludes ids already watched", () => {
  const result = filterMovies(MOVIES, { onlyUnwatched: true, watchedIds: [1, 3] });
  assert.deepEqual(result.map((m) => m.id), [2]);
});

test("filterMovies search matches part of the title, case-insensitive", () => {
  const result = filterMovies(MOVIES, { search: "cisnes" });
  assert.deepEqual(result.map((m) => m.id), [2]);
});

test("filterMovies with no options returns everything unchanged", () => {
  const result = filterMovies(MOVIES);
  assert.equal(result.length, 3);
});

test("sortMoviesByYear ascending puts the oldest first", () => {
  const result = sortMoviesByYear(MOVIES);
  assert.deepEqual(result.map((m) => m.year), [2003, 2006, 2024]);
});

test("sortMoviesByYear descending puts the newest first", () => {
  const result = sortMoviesByYear(MOVIES, "desc");
  assert.deepEqual(result.map((m) => m.year), [2024, 2006, 2003]);
});

test("sortMoviesAlphabetically sorts by title", () => {
  const result = sortMoviesAlphabetically(MOVIES);
  assert.deepEqual(
    result.map((m) => m.id),
    [1, 2, 3], // "Barbie e...", "Barbie no...", "Barbie: A Journey..." (localeCompare pt-BR)
  );
});

test("sortMoviesByYear does not mutate the original array", () => {
  const copy = [...MOVIES];
  sortMoviesByYear(MOVIES, "desc");
  assert.deepEqual(MOVIES, copy);
});

test("availableYears returns the distinct years in order", () => {
  assert.deepEqual(availableYears(MOVIES), [2003, 2006, 2024]);
});

test("isCompleted is true only when watched AND rated", () => {
  const progress = { watched: [1, 2], ratings: { 1: 5 } };
  assert.equal(isCompleted(progress, 1), true); // assistido + nota
  assert.equal(isCompleted(progress, 2), false); // assistido, sem nota
  assert.equal(isCompleted(progress, 3), false); // nem assistido
});

test("splitByCompletion separates watched+rated movies from the rest", () => {
  const progress = { watched: [1, 2], ratings: { 1: 5 } };
  const { active, completed } = splitByCompletion(MOVIES, progress);
  assert.deepEqual(completed.map((m) => m.id), [1]);
  assert.deepEqual(active.map((m) => m.id), [2, 3]);
});

test("splitByCompletion treats a rating of 0 as not rated", () => {
  const progress = { watched: [1], ratings: { 1: 0 } };
  const { active, completed } = splitByCompletion(MOVIES, progress);
  assert.deepEqual(completed, []);
  assert.deepEqual(active.map((m) => m.id), [1, 2, 3]);
});

test("sortMoviesByRating puts the highest rated first by default", () => {
  const result = sortMoviesByRating(MOVIES, { 1: 3, 2: 5, 3: 1 });
  assert.deepEqual(result.map((m) => m.id), [2, 1, 3]);
});

test("sortMoviesByRating treats missing ratings as 0, always last when descending", () => {
  const result = sortMoviesByRating(MOVIES, { 2: 4 });
  assert.deepEqual(result.map((m) => m.id)[0], 2);
});

test("sortMoviesByRating ascending puts the lowest rated first", () => {
  const result = sortMoviesByRating(MOVIES, { 1: 3, 2: 5, 3: 1 }, "asc");
  assert.deepEqual(result.map((m) => m.id), [3, 1, 2]);
});

test("splitUpcoming keeps a movie released today or earlier in 'released'", () => {
  const movies = [{ id: 1, releaseDate: "2024-01-01" }];
  const { released, upcoming } = splitUpcoming(movies, new Date("2024-01-01T12:00:00Z"));
  assert.deepEqual(released.map((m) => m.id), [1]);
  assert.deepEqual(upcoming, []);
});

test("splitUpcoming moves a future release date to 'upcoming'", () => {
  const movies = [{ id: 1, releaseDate: "2030-01-01" }];
  const { released, upcoming } = splitUpcoming(movies, new Date("2024-01-01T12:00:00Z"));
  assert.deepEqual(released, []);
  assert.deepEqual(upcoming.map((m) => m.id), [1]);
});

test("isMovieUpcoming is true only for a releaseDate strictly after today", () => {
  const now = new Date("2024-06-15T12:00:00Z");
  assert.equal(isMovieUpcoming({ releaseDate: "2024-06-16" }, now), true);
  assert.equal(isMovieUpcoming({ releaseDate: "2024-06-15" }, now), false);
  assert.equal(isMovieUpcoming({ releaseDate: "2024-06-14" }, now), false);
  assert.equal(isMovieUpcoming({}, now), false);
});

test("splitUpcoming treats a movie without releaseDate as released", () => {
  const movies = [{ id: 1 }];
  const { released, upcoming } = splitUpcoming(movies, new Date("2024-01-01T12:00:00Z"));
  assert.deepEqual(released.map((m) => m.id), [1]);
  assert.deepEqual(upcoming, []);
});
