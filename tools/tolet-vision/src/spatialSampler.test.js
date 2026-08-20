import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineMeters, sampleWayCoordinates, sampleCoverage } from "./spatialSampler.js";

test("haversineMeters: one degree of longitude at the equator is ~111.2km", () => {
  const a = { lat: 0, lon: 0 };
  const b = { lat: 0, lon: 1 };
  const meters = haversineMeters(a, b);
  assert.ok(Math.abs(meters - 111195) < 50, `expected ~111195m, got ${meters}`);
});

test("haversineMeters: same point is zero distance", () => {
  const p = { lat: 12.9352, lon: 77.6245 };
  assert.equal(haversineMeters(p, p), 0);
});

test("sampleWayCoordinates: empty/singleton coordinate lists", () => {
  assert.deepEqual(sampleWayCoordinates([], 50), []);
  const single = sampleWayCoordinates([[77.6245, 12.9352]], 50);
  assert.deepEqual(single, [{ lat: 12.9352, lon: 77.6245 }]);
});

test("sampleWayCoordinates: always includes the start point", () => {
  const coords = [
    [77.6245, 12.9352],
    [77.6255, 12.9362],
  ];
  const samples = sampleWayCoordinates(coords, 1_000_000); // step far longer than the way itself
  assert.equal(samples.length, 1);
  assert.deepEqual(samples[0], { lat: 12.9352, lon: 77.6245 });
});

test("sampleWayCoordinates: a straight line is sampled at roughly even step spacing", () => {
  // ~1.11km due north (0.01 deg lat), no longitude change — an easy case to
  // check spacing against, since haversine along a pure-latitude line is
  // just the same formula degrees-to-meters conversion.
  const coords = [
    [77.6, 12.9],
    [77.6, 12.91],
  ];
  const stepMeters = 200;
  const samples = sampleWayCoordinates(coords, stepMeters);

  assert.ok(samples.length >= 4, `expected several samples along ~1.1km, got ${samples.length}`);
  for (let i = 1; i < samples.length; i++) {
    const d = haversineMeters(samples[i - 1], samples[i]);
    assert.ok(Math.abs(d - stepMeters) < 5, `step ${i} was ${d}m, expected ~${stepMeters}m`);
  }
});

test("sampleWayCoordinates: skips zero-length (duplicate consecutive) segments without infinite-looping", () => {
  const coords = [
    [77.6, 12.9],
    [77.6, 12.9], // duplicate vertex
    [77.6, 12.91],
  ];
  const samples = sampleWayCoordinates(coords, 200);
  assert.ok(samples.length >= 2);
});

test("sampleCoverage: no ways in the response yields no samples", () => {
  assert.deepEqual(sampleCoverage({ payload: { ways: [] } }, { stepMeters: 70, maxPoints: 100 }), []);
  assert.deepEqual(sampleCoverage({}, { stepMeters: 70, maxPoints: 100 }), []);
});

test("sampleCoverage: flattens multiple ways and tags each sample with its way_id", () => {
  const coverageBody = {
    payload: {
      ways: [
        { way_id: 1, line_geometry: { geometry: { coordinates: [[77.6, 12.9], [77.6, 12.905]] } } },
        { way_id: 2, line_geometry: { geometry: { coordinates: [[77.61, 12.91], [77.61, 12.915]] } } },
      ],
    },
  };
  const samples = sampleCoverage(coverageBody, { stepMeters: 100, maxPoints: 1000 });
  assert.ok(samples.some((s) => s.wayId === 1));
  assert.ok(samples.some((s) => s.wayId === 2));
});

test("sampleCoverage: stops exactly at maxPoints across ways, not per-way", () => {
  const coverageBody = {
    payload: {
      ways: [
        { way_id: 1, line_geometry: { geometry: { coordinates: [[77.6, 12.9], [77.6, 12.95]] } } },
        { way_id: 2, line_geometry: { geometry: { coordinates: [[77.61, 12.9], [77.61, 12.95]] } } },
      ],
    },
  };
  const samples = sampleCoverage(coverageBody, { stepMeters: 50, maxPoints: 5 });
  assert.equal(samples.length, 5);
});
