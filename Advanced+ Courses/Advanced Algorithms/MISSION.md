# Mission: Advanced Algorithms

## Why
Computer Programming 2+ deliberately drew a line: pattern recognition and interview performance, not formal proofs, and not the genuinely advanced data structures and graph algorithms it explicitly named out of scope (segment trees, Fenwick trees, network flow, computational geometry, amortized-analysis proofs, self-balancing tree implementations). This course exists to cross that line — a rigorous, proof-based algorithms course in the university "Design and Analysis of Algorithms" tradition, where every technique comes with a correctness or complexity argument, not just an implementation.

## Success looks like
- States and proves the Master Theorem, and falls back to the recursion-tree method when a recurrence doesn't fit its form.
- Proves a greedy algorithm correct with an exchange argument, rather than trusting a greedy heuristic by pattern-matching.
- Analyzes the amortized cost of a dynamic array or a Union-Find with path compression using the potential method, in full.
- Comfortable with the standard toolkit of advanced graph algorithms — Bellman-Ford, Floyd-Warshall, Kosaraju's and Tarjan's SCC algorithms, and network flow via Ford-Fulkerson — and can state which invariant each correctness proof turns on.
- Implements segment trees, Fenwick trees, and an AVL tree with rotations from scratch, and explains why each achieves its stated time complexity.
- States what P, NP, and NP-completeness mean formally, reduces one NP-complete problem to another, and recognizes when a new problem is likely intractable rather than just "hard."
- Traces the Knuth-Morris-Pratt algorithm by hand and explains why it never backtracks the text pointer.

## Constraints
- **Hard prerequisite: Computer Programming 1 and Computer Programming 2 must both be completed first.** Assumes Big-O intuition, recursion, and the core data structures (stacks, queues, linked lists, hash maps) from CP2's Unit 3 and Unit 5 without re-teaching them.
- Deliberately proof-heavy, unlike Computer Programming 2+ — every algorithm here comes with a correctness or complexity proof, not just an implementation and a worked example. This is the CS-theory register, not the interview-prep register.
- Where Computer Programming 2+ already covered a topic from the interview-pattern angle (Dijkstra's algorithm, basic DP, basic Union-Find, basic graph traversal), this course assumes that lesson rather than re-teaching it, and instead covers the rigor CP2+ explicitly declined: Union-Find's amortized-complexity proof, DP correctness by induction, and so on.
- Single-language pseudocode throughout, not the four-parallel-language format of CP1/CP2/CP2+ — at this level the algorithm's structure is the point, not language syntax, and pseudocode is standard practice in every textbook this course draws from.
- No assigned textbook or standards body — self-designed sequence following the standard topic order of Cormen, Leiserson, Rivest & Stein's *Introduction to Algorithms* (CLRS) and Kleinberg & Tardos's *Algorithm Design*, the two most widely used university algorithms textbooks. See `NOTES.md` for the unit plan.

## Out of scope
- Approximation and randomized algorithms beyond a single closing lesson each — genuinely graduate-level depth (semidefinite-programming-based approximation, derandomization) is flagged as further reading, not taught.
- Computational geometry, and suffix structures beyond one introductory lesson, and advanced flow (min-cost flow, multi-commodity flow) — real topics, but roughly double this course's length; named as "where to go next" in the capstone.
- Parallel and distributed algorithms — a genuinely separate course's worth of material.
