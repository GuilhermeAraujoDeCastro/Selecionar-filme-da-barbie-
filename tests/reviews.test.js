import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReview } from "../js/reviews.js";

test("validateReview trims whitespace from a valid review", () => {
  assert.equal(validateReview("  Muito bom!  "), "Muito bom!");
});

test("validateReview accepts an empty string (clearing the review)", () => {
  assert.equal(validateReview(""), "");
  assert.equal(validateReview("   "), "");
});

test("validateReview rejects text over 500 characters", () => {
  assert.equal(validateReview("a".repeat(501)), null);
});

test("validateReview accepts text at exactly 500 characters", () => {
  assert.equal(validateReview("a".repeat(500)), "a".repeat(500));
});

test("validateReview rejects non-string values", () => {
  assert.equal(validateReview(null), null);
  assert.equal(validateReview(undefined), null);
  assert.equal(validateReview(42), null);
});
