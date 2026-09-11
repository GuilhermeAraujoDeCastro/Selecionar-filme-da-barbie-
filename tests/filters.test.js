import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableYears,
  filterMovies,
  isCompleted,
  sortMoviesAlphabetically,
  sortMoviesByYear,
  splitByCompletion,
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
