import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOpts, pickDensity, makeStars } from '../src/lib/starfield.js';

test('normalizeOpts 应用默认值', () => {
  const o = normalizeOpts({});
  assert.equal(o.density, 140);
  assert.equal(o.speed, 0.5);
  assert.equal(o.parallax, 0.04);
  assert.equal(o.brightness, 1);
});

test('normalizeOpts 钳制非法输入', () => {
  const o = normalizeOpts({ density: 9999, speed: -1, parallax: 5, brightness: 0 });
  assert.equal(o.density, 600);
  assert.equal(o.speed, 0);
  assert.equal(o.parallax, 0.2);
  assert.ok(o.brightness >= 0.2);
});

test('pickDensity 移动端减半', () => {
  assert.equal(pickDensity(200, false), 200);
  assert.equal(pickDensity(200, true), 100);
  assert.equal(pickDensity(141, true), 71); // 141/2=70.5，四舍五入 71
});

test('makeStars 生成指定数量且在画布范围、r 在 (0, 3]', () => {
  const rng = () => 0.5; // 确定性
  const stars = makeStars(1000, 500, 24, rng);
  assert.equal(stars.length, 24);
  for (const s of stars) {
    assert.ok(s.x >= 0 && s.x <= 1000);
    assert.ok(s.y >= 0 && s.y <= 500);
    assert.ok(s.r > 0 && s.r <= 3);
    assert.ok(s.a > 0 && s.a <= 1);
    assert.ok(s.tw >= 0 && s.tw <= Math.PI * 2);
  }
});
