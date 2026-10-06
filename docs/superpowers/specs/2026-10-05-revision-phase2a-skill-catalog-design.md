# Revision Phase 2a — Skill Catalog — Design

## Context

Phase 2 ("Intelligence") of the STEM+ revision splits into 2a skill catalog, 2b diagnostic, 2c mastery engine; 2b and 2c read the catalog. Spec §4 (Skill Graph) and §29 (data model); audit §7, §9, §15. User decision (2026-10-05): **one skill per course unit**.

## Catalog

`public/assets/skill-catalog.json`, generated and committed:

```json
{
  "version": 1,
  "skills": [
    {
      "id": "precalculus.u3",
      "name": "Exponential and Logarithmic Functions",
      "course": "Precalculus",
      "unit": "Unit 3",
      "lessons": 8,
      "prerequisites": ["precalculus.u2"],
      "problemTopics": ["Exponential and logarithmic functions"]
    }
  ]
}
```

- **One skill per unit** of all 40 courses (283 today), in `COURSE_PATHS` order, then unit order.
- **ID** `<course-slug>.u<N>`. Course slug: lowercase name, `+` → `-plus`, every other run of non-alphanumerics → `-` (`Computer Programming 2+` → `computer-programming-2-plus`). IDs are permanent: progress will be keyed by them (2c), so they must never change meaning.
- **name**: the unit title from the course `index.html` `<summary>Unit N: Title</summary>`, HTML entities decoded.
- **lessons**: count of `NNNN-*.html` lesson files in the unit folder.
- **prerequisites**: unit N requires unit N−1 of its course; a course's first unit requires the last unit of each course listed for it in `lib/plan-catalog.js` `PREREQUISITE_GRAPH`.
- **problemTopics**: the course's Problem Set topics assigned to this unit (empty for the 20 courses without a Problem Set).

## Generator

`scripts/build-skill-catalog.js` exports `buildCatalog()` and writes the file when run directly. Sources: `COURSE_PATHS` and `PROBLEM_SET_SLUGS` parsed from `public/assets/tests.js`, `PREREQUISITE_GRAPH` and `decodeEntities` from `lib/plan-catalog.js`, course `index.html` unit headings, unit folders, `public/assets/problem-banks.js` topics. The only hand-written data is `PROBLEM_TOPIC_UNITS` (Problem Set slug → topic → unit number, 120 entries). `buildCatalog()` throws when a course's unit headings and unit folders disagree, a Problem Set topic has no unit, or a mapping names a topic or unit that doesn't exist.

## Check

`scripts/check-skill-catalog.js` in `npm test`:

- The committed file equals a fresh `buildCatalog()` (fails with "run node scripts/build-skill-catalog.js").
- IDs unique; skill count equals the number of unit folders; every prerequisite exists; the prerequisite graph is acyclic; every skill has ≥ 1 lesson; every Problem Set topic appears on exactly one skill.
- Pinned examples: `precalculus.u3` is "Exponential and Logarithmic Functions" requiring `precalculus.u2`; `ap-calculus-bc.u1` requires `precalculus.u6`; `quantum-computing.u1` requires `linear-algebra-a.u7` and `linear-algebra-b`'s last unit.

## Not included

No UI (2b/2c are the first consumers), no subject tags, no Application/project links (Phase 4), no sub-unit skills.
