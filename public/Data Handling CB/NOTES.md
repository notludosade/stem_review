# Notes: Data Handling: CB

## Planned structure (8 units, 33 lessons)

- Unit 1 — Data Fundamentals (1-4): What Counts as Data · Where Data Comes From · Data Quality · Databases vs. Spreadsheets vs. Files
- Unit 2 — Spreadsheets as a Data Tool (5-8): Core Spreadsheet Functions · Lookups and Data Joining · Pivot Tables · Data Validation & Clean Input
- Unit 3 — Databases & SQL (9-13): The Relational Model · SELECT, WHERE, and Filtering · Joins · Aggregation · Subqueries and CTEs
- Unit 4 — Statistics for Data Analysis (14-18): Descriptive Statistics · Distributions · Correlation vs. Causation · Confidence Intervals & Margin of Error · Intro to Regression
- Unit 5 — Data Cleaning & Preparation (19-22): Handling Missing Data · Outliers · Deduplication & Standardization · From Raw to Analysis-Ready
- Unit 6 — Data Visualization & Storytelling (23-26): Choosing the Right Chart · How Charts Mislead · Designing for the Audience · Telling a Data Story
- Unit 7 — Data Ethics, Privacy & Governance (27-29): PII & Anonymization · Bias in Data and Analysis · Data Governance & Regulation, Briefly
- Unit 8 — Data Careers & Capstone (30-33): Data Roles · Building a Data Portfolio · The Data Case-Study Interview · Capstone — A Full Data Handling Pipeline

## Conventions (matching site-wide standard)
- Top-level course (not under Advanced+ Courses), so asset paths are `../../assets/...` from lesson files and `../assets/...` from course-root index.html / reference/glossary.html.
- 5-question quiz per lesson: 3 multiple-choice + 2 fill-in-blank, `data-answers="a|b"` pipe-separated alternates (never comma).
- Content boxes: `<div class="box">` (definitions/procedures), `<div class="box why">` (motivation/subtlety), `<div class="box example">` (worked examples).
- SQL examples use standard/portable syntax (no vendor-specific dialect), per MISSION.md constraint.
- No formal prerequisite — accessible entry point. Unit 4 statistics content assumes only basic algebra.
- Capstone (Lesson 33) follows the established capstone template: no nav-next, one box per unit tracing the course's dependency chain, closing why-box, "This closes Data Handling: CB — ..." line, footer "— end of course" suffix.
- Internal cross-reference threads to plant and resolve across units (mirroring the technique used in Advanced Algorithms):
  - Unit 1's sampling bias (Lesson 2) should be explicitly revisited in Unit 4's confidence intervals (Lesson 17) and Unit 7's bias lesson (Lesson 28).
  - Unit 2's spreadsheet joins (Lesson 6) should be explicitly connected to Unit 3's SQL joins (Lesson 11) as the same operation in two tools.
  - Unit 5's cleaning decisions (missing data, outliers) should be explicitly referenced in Unit 6's chart-honesty lesson (Lesson 24) and the Unit 8 capstone.
  - Unit 4's correlation-vs-causation lesson (Lesson 16) should be explicitly referenced in Unit 6's storytelling lesson (Lesson 26) as a discipline for honest narrative claims.
