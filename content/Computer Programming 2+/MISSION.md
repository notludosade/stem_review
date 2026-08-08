# Mission: Computer Programming 2+

## Why
Computer Programming 2 built working intuition for OOP, core data structures, recursion, and the basics of algorithmic complexity — but it deliberately stopped short of the patterns that dominate technical interviews and competitive programming: trees, heaps, graphs, backtracking, dynamic programming, and the pattern-recognition instincts that let someone see a new problem and know which tool applies. This course exists to close that gap directly, with LeetCode-style problems as the proving ground and two concrete payoffs: performing well in technical coding interviews, and holding up in timed competitive-programming settings (contests, online judges).

## Success looks like
- Given an unfamiliar problem, recognizes which pattern applies (two pointers, sliding window, backtracking, DP, etc.) from its shape and constraints, not by having memorized the exact problem before.
- Implements and explains the core patterns — two pointers/sliding window, binary search on an answer space, tree and graph traversal (DFS/BFS), heaps, backtracking, dynamic programming, greedy, union-find, bit tricks — in all four course languages.
- Talks through a solution out loud the way an interview expects: clarify constraints, propose a brute force, identify the bottleneck, optimize, and test edge cases — before writing a full solution.
- Solves real, cited LeetCode problems after every pattern lesson, unassisted, within a reasonable time budget.
- Reads a problem's constraints (input size, time limit) and correctly predicts what time complexity is required to pass — a core competitive-programming reflex.
- Knows where advanced topics (segment trees, advanced flow algorithms, computational geometry) live for further growth, without needing to master them here.

## Constraints
- Continues the four-language-in-parallel format (Python, Java, JavaScript, C++), same ordering and shared components as Computer Programming 1 and 2.
- **Hard prerequisite: Computer Programming 1 and Computer Programming 2 must both be completed first.** This course assumes OOP, stacks/queues/linked lists/hash maps, recursion, Big-O basics, and linear/binary search and comparison sorts without re-teaching them — it builds directly on top of Computer Programming 2's Unit 3 (Core Data Structures) and Unit 5 (Algorithms & Complexity).
- Every pattern lesson closes with a "Practice on LeetCode" citation — real problems, by number and name, matched to that lesson's technique. This is a deliberate departure from earlier courses (which were fully self-contained) because the mission is explicitly about performance on an external platform.
- No assigned textbook or standards body — self-designed sequence following the widely-used "pattern" framing popularized by NeetCode and the Blind 75 / NeetCode 150 lists. See `NOTES.md` for the unit plan.

## Out of scope
- Segment trees, Fenwick/binary indexed trees, advanced flow algorithms, computational geometry, and other USACO Gold/Platinum-tier topics — these are genuinely advanced competitive-programming territory beyond what most technical interviews require; flagged in the capstone unit as "where to go next," not taught here.
- Formal proofs of algorithmic correctness or complexity (loop invariants, amortized-analysis proofs in full rigor) — this course builds correct working intuition and the ability to derive complexity by inspection, not a proof-based algorithms course.
- Implementing self-balancing trees (AVL, Red-Black) from scratch — covered conceptually only (why they exist), since LeetCode itself very rarely asks for this and real code reaches for a language's built-in balanced structure instead.
