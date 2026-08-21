import { describe, it, expect } from 'vitest';
import { ALL_FISH } from '../src/data/fish/index.ts';
import { patternById } from '../src/data/fish/types.ts';
import type { FishDefinition } from '../src/data/fish/types.ts';
import { FISH_BAND_HYSTERESIS } from '../src/data/config.ts';

/**
 * The rules every fish has to obey, checked against every fish there is.
 *
 * architecture.md section 4 asks for this by name: a validation test asserting
 * that every fish has at least one pattern that punishes being close and one
 * that punishes being far, per design.md section 3's no-safe-camping-spot rule.
 * Without both, the optimal strategy collapses to one position and the movement
 * axis — design.md's second pillar — stops mattering.
 *
 * The rest of what is here is the format resolving. Task 3.3 adds three fish as
 * data alone, and the faults it can plausibly introduce are a mistyped pattern
 * id, a band list out of order, and a resting depth that quietly puts an attack
 * out of reach. All three would surface either as a throw mid-fight or as a fish
 * that plays wrong without failing anything, which is worse. They belong here.
 *
 * What is **not** here is anything about whether a fish is any good. Whether 400
 * resistance is the right length of fight is a playtest question and stays one.
 */

/**
 * Every module in `data/fish/`, whether the registry knows about it or not.
 *
 * `import.meta.glob` rather than reading the directory with `node:fs`, which
 * would need `@types/node` added to the project for one test. It is a Vite
 * feature and `vite/client` is already in the tsconfig, and it lives here in the
 * test rather than in `src/`, so nothing that moves to the Colyseus server in
 * phase 7 picks up a dependency on the bundler.
 */
const FISH_MODULES: Record<string, unknown> = import.meta.glob(
  '../src/data/fish/*.ts',
  { eager: true },
);

/** The two files in `data/fish/` that are not fish. */
const NOT_A_FISH = ['types.ts', 'index.ts'];

describe('the fish registry', () => {
  it('is not empty', () => {
    expect(ALL_FISH.length).toBeGreaterThan(0);
  });

  it('gives every fish a unique id', () => {
    // Phase 4's record book and encounter table key on the id, so two fish
    // sharing one would merge in the book rather than fail anywhere.
    const ids = ALL_FISH.map((fish) => fish.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * The test that makes "every fish" mean every fish.
   *
   * Everything else in this file loops over `ALL_FISH`, so a fish added to
   * `data/fish/` but not to the registry would be validated by nothing at all
   * and would still be playable the moment an encounter table names it. Reading
   * the directory is what stops a half-finished addition from being invisible.
   */
  it('holds every fish file in the directory', () => {
    const files = Object.keys(FISH_MODULES).filter(
      (path) => !NOT_A_FISH.some((name) => path.endsWith(`/${name}`)),
    );

    expect(files.length).toBe(ALL_FISH.length);

    for (const path of files) {
      const exported = Object.values(
        FISH_MODULES[path] as Record<string, unknown>,
      ).filter(isFishDefinition);

      // A file in this directory that exports no fish is either a helper that
      // belongs in `types.ts` or a definition half written, and both are worth
      // hearing about.
      expect(exported.length, `${path} exports no fish`).toBeGreaterThan(0);
      for (const fish of exported) {
        expect(ALL_FISH, `${path} is not in ALL_FISH`).toContain(fish);
      }
    }
  });
});

/** Structural enough to tell a fish from a helper, and no more. */
function isFishDefinition(value: unknown): value is FishDefinition {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<FishDefinition>;

  return (
    typeof candidate.id === 'string' &&
    Array.isArray(candidate.bands) &&
    Array.isArray(candidate.patterns)
  );
}

/**
 * Which patterns the fish can actually reach, in the order its bands name them.
 *
 * The coverage rule below is about what the fish **does**, not about what is
 * written in its `patterns` list. A pattern no band lists is dead data, and a
 * fish that satisfied the no-safe-camping-spot rule with one would have a safe
 * camping spot anyway.
 */
function reachablePatterns(fish: FishDefinition) {
  return fish.bands.flatMap((band) =>
    band.attacks.map((attack) => patternById(fish, attack.patternId)),
  );
}

describe.each(ALL_FISH.map((fish) => [fish.id, fish] as const))(
  'fish: %s',
  (_id, fish) => {
    // design.md section 3, and the whole reason this file was asked for.
    it('can punish a boat that stands close and one that stands far', () => {
      const punished = new Set(
        reachablePatterns(fish).map((pattern) => pattern.punishes),
      );

      expect(punished.has('close')).toBe(true);
      expect(punished.has('far')).toBe(true);
    });

    it('names every pattern once', () => {
      // `patternById` finds the first match, so a duplicate id would shadow the
      // other silently and the fish would run one attack believing it was the
      // other for its whole moveset.
      const ids = fish.patterns.map((pattern) => pattern.id);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has a band for every attack and an attack for every band', () => {
      expect(fish.bands.length).toBeGreaterThan(0);

      for (const band of fish.bands) {
        expect(band.attacks.length).toBeGreaterThan(0);

        // Throws on an id that resolves to nothing, which is the mistyped-id
        // fault, caught here rather than the first time the fish is fought.
        for (const attack of band.attacks) {
          expect(patternById(fish, attack.patternId)).toBeDefined();
        }
      }
    });

    it('leaves no pattern that nothing can reach', () => {
      const reachable = new Set(
        reachablePatterns(fish).map((pattern) => pattern.id),
      );

      for (const pattern of fish.patterns) {
        expect(reachable.has(pattern.id)).toBe(true);
      }
    });

    it('orders its bands nearest first and covers the whole lane', () => {
      // `bandFor` walks the list in order and stops at the first band whose far
      // edge the length is inside, so an unordered list would answer with a band
      // the fight is not in, and a finite outermost edge would throw once the
      // boat backed far enough away.
      const edges = fish.bands.map((band) => band.maxDistance);

      for (let i = 1; i < edges.length; i++) {
        expect(edges[i]).toBeGreaterThan(edges[i - 1]);
      }
      expect(edges[edges.length - 1]).toBe(Infinity);
    });

    it('can be pulled into every band by a boat standing overhead', () => {
      // The no-safe-camping-spot rule from the fish's own side of it. A boat
      // directly above the fish is exactly `depth` away, so a fish whose station
      // in one band is deeper than the next band in has room for means it can
      // never be drawn into that band at all: it would hold the outer station for
      // the whole fight and the inner band's attacks would never fire once.
      //
      // Checked against `maxDistance - HYSTERESIS` rather than `maxDistance`,
      // because the margin is what a length has to be inside before the band
      // actually changes. The same trap as roadmap invariant 1.
      for (let i = 1; i < fish.bands.length; i++) {
        const inner = fish.bands[i - 1];
        const outer = fish.bands[i];

        expect(outer.restingDepth).toBeLessThanOrEqual(
          inner.maxDistance - FISH_BAND_HYSTERESIS,
        );
      }
    });
  },
);
