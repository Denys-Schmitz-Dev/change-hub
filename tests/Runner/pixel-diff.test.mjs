import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightPixels } from '../../resources/js/pixel-diff.ts';
const pixels = (width, height, values) => ({ width, height, data: new Uint8ClampedArray(values) });
test('identical pixels stay unchanged and input buffers are preserved', () => {
 const a = pixels(1, 1, [255, 255, 255, 255]);
 const result = highlightPixels(a, a);
 assert.equal(result.changed, 0); assert.deepEqual(result.left, a.data);
});
test('changed pixels are tinted red before and green after', () => {
 const a = pixels(1, 1, [255, 255, 255, 255]), b = pixels(1, 1, [0, 0, 0, 255]);
 const result = highlightPixels(a, b);
 assert.equal(result.changed, 1); assert.ok(result.left[0] > result.left[1]); assert.ok(result.right[1] > result.right[0]);
 assert.equal(a.data[0], 255); assert.equal(b.data[0], 0);
});
test('tolerance and transparency compare visible colors', () => {
 const a = pixels(1, 1, [255, 255, 255, 255]);
 assert.equal(highlightPixels(a, pixels(1, 1, [245, 245, 245, 255])).changed, 0);
 assert.equal(highlightPixels(a, pixels(1, 1, [245, 245, 245, 255]), 0).changed, 1);
 assert.equal(highlightPixels(a, pixels(1, 1, [0, 0, 0, 0])).changed, 0);
});
test('different dimensions count missing area without counting absent corners', () => {
 const a = pixels(2, 1, Array(8).fill(255)), b = pixels(1, 2, Array(8).fill(255));
 const result = highlightPixels(a, b);
 assert.equal(result.changed, 2); assert.equal(result.total, 3);
});
