# Notes: Advanced Algorithms

## Unit plan (8 units, 34 lessons)

1. **Algorithm Analysis, Rigorously** (4): Asymptotic Notation Formally · Recursion Tree Method · The Master Theorem · Amortized Analysis (aggregate/accounting/potential)
2. **Divide and Conquer** (4): Correctness by Strong Induction · Counting Inversions & Merge Sort · Median of Medians · Strassen's Algorithm
3. **Greedy Algorithms & MSTs** (4): Exchange Arguments · Kruskal's & Prim's · The Cut Property · Huffman Coding
4. **Advanced Graph Algorithms** (5): Bellman-Ford · Floyd-Warshall · SCC (Kosaraju's & Tarjan's) · Ford-Fulkerson · Max-Flow Min-Cut
5. **Advanced Dynamic Programming** (4): DP on Trees · Bitmask DP (TSP) · Matrix Chain Multiplication · Matrix Exponentiation
6. **Advanced Data Structures** (5): Segment Trees · Fenwick Trees · AVL Rotations · Disjoint Set Union, Proved · Tries
7. **String Algorithms** (3): KMP · Rabin-Karp / Rolling Hashes · Suffix Arrays, First Look
8. **Computational Complexity & Intractability** (5): P vs. NP & Reductions · NP-Completeness & Cook-Levin · Common NP-Complete Problems · Approximation Algorithms · Capstone

Total: 34 lessons, matching site scale (CP2+ = 34/9, Real Analysis A = 34/6).

## Format decisions

- Single-language pseudocode throughout (not 4-language parallel format) — reasoning documented in MISSION.md Constraints.
- Every lesson needs at least one correctness or complexity proof, not just a worked example — this is the register that distinguishes this course from CP2+.
- Where CP2+ already taught a topic informally (Dijkstra, basic DP, basic Union-Find, basic traversal), cite it by exact lesson title and number, then go straight to the rigor CP2+ skipped — don't re-teach the mechanics.
- Capstone (Lesson 34) follows the Real Analysis A/B template: no nav-next, one box per unit tracing the dependency chain, closing "This closes Advanced Algorithms — ..." line, "— end of course" footer suffix.

## Working citations map (CP2+ lessons this course explicitly builds on top of, not repeats)

- Dijkstra's algorithm, topological sort, basic Union-Find, basic graph traversal, basic DP — all from CP2+ Unit 6/7/8 (exact numbers to confirm per-lesson when cited).
