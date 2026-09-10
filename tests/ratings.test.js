import { test } from "node:test";
import assert from "node:assert/strict";
import { averageRating, validateRating } from "../js/ratings.js";

test("validateRating accepts integers from 1 to 5", () => {
  assert.equal(validateRating(1), 1);
  assert.equal(validateRating(5), 5);
  assert.equal(validateRating("3"), 3);
});

test("validateRating rejects out-of-range values", () => {
  assert.equal(validateRating(0), null);
  assert.equal(validateRating(6), null);
  assert.equal(validateRating(-1), null);
});

test("validateRating rejects non-integers and non-numbers", () => {
  assert.equal(validateRating(2.5), null);
  assert.equal(validateRating("estrelas"), null);
  assert.equal(validateRating(null), null);
  assert.equal(validateRating(undefined), null);
});

test("averageRating computes the mean of the given ratings", () => {
  const avg = averageRating({ 1: 5, 2: 4, 3: 3 });
  assert.equal(avg, 4);
});

test("averageRating rounds to 1 decimal place", () => {
  const avg = averageRating({ 1: 5, 2: 4, 3: 4 });
  assert.equal(avg, 4.3); // (5+4+4)/3 = 4.333...
});

test("averageRating ignores null/undefined entries", () => {
  const avg = averageRating({ 1: 5, 2: null, 3: undefined, 4: 3 });
  assert.equal(avg, 4);
});

test("averageRating with no ratings returns null", () => {
  assert.equal(averageRating({}), null);
});
