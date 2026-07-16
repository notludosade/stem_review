# Notes: Computer Programming 2+

## User preferences
- User named the course "Computer Programming 2+" explicitly.
- Explicit hard prerequisite: Computer Programming 1 and Computer Programming 2 must both be completed first — must be stated in `MISSION.md`, the course `index.html` intro, and the STEM+ hub card.
- Binding scope decisions (from AskUserQuestion, do not re-ask):
  - **Keep the 4-language-parallel format** (Python, Java, JavaScript, C++), same order as CP1/CP2 — not single-language.
  - **Dual motivation**: technical interview prep AND competitive programming/contests, roughly equally weighted (user picked "mostly 1 and 2" over a single pure motivation).
  - **Cite real external LeetCode problems** by number and name after every pattern lesson, as a new "Practice on LeetCode" convention — a deliberate departure from every earlier STEM+ course, which were fully self-contained.

## Unit plan (34 lessons across 9 units, flat numbering 0001-0034)

**Unit 1: Thinking Like a Problem Solver** (3 lessons)
1. From Brute Force to Optimal — Two Sum (LeetCode #1): nested-loop O(n²) vs. hash-map O(n), establishing the brute-force-then-optimize habit.
2. Big-O in Practice: Time and Space Together — deeper rigor than CP2's Unit 5: analyzing nested/independent loops, informal recursive cost, space-time tradeoffs, a note on amortized analysis (dynamic array doubling).
3. A Repeatable Framework for New Problems — clarify constraints → brute force → find the bottleneck → pattern-match → optimize → test edge cases. Also: reading input-size constraints to predict the required complexity (the competitive-programming reflex).

**Unit 2: Two Pointers & Sliding Window** (4 lessons)
4. Opposite-Direction Two Pointers — Two Sum II / Valid Palindrome pattern (LeetCode #167).
5. Fast & Slow Pointers — cycle detection (LeetCode #141, Linked List Cycle).
6. Fixed-Size Sliding Window — max sum subarray of size k.
7. Variable-Size Sliding Window — Longest Substring Without Repeating Characters (LeetCode #3).

**Unit 3: Binary Search Beyond Sorted Arrays** (3 lessons)
8. Binary Search Revisited on Rotated Arrays — Search in Rotated Sorted Array (LeetCode #33).
9. Binary Search on the Answer Space — Koko Eating Bananas (LeetCode #875).
10. Finding Boundaries — Find First and Last Position of Element in Sorted Array (LeetCode #34).

**Unit 4: Trees** (4 lessons)
11. Binary Trees & Depth-First Traversals — in-order/pre-order/post-order, recursive and iterative.
12. Breadth-First / Level-Order Traversal (LeetCode #102).
13. Binary Search Trees: Properties and Validation (LeetCode #98) — includes a conceptual aside on why self-balancing trees (AVL/Red-Black) exist, without implementing one (out of scope per `MISSION.md`).
14. Common Tree Patterns: Lowest Common Ancestor & Path Sum (LeetCode #236, #112).

**Unit 5: Heaps & Priority Queues** (3 lessons)
15. Heap Fundamentals — min-heap, max-heap, heapify.
16. The Kth Largest/Smallest Pattern (LeetCode #215).
17. Merging with a Heap — Top K Frequent Elements (LeetCode #347).

**Unit 6: Graphs** (5 lessons)
18. Representing Graphs & Depth-First Search — Number of Islands (LeetCode #200).
19. Breadth-First Search & Shortest Paths in Unweighted Graphs — Rotting Oranges (LeetCode #994).
20. Topological Sort — Course Schedule (LeetCode #207).
21. Union-Find / Disjoint Set — Redundant Connection (LeetCode #684).
22. Weighted Shortest Paths: Dijkstra's Algorithm — Network Delay Time (LeetCode #743).

**Unit 7: Backtracking** (3 lessons)
23. Backtracking Fundamentals — Subsets & Permutations (LeetCode #78, #46).
24. Combinations Under Constraints — Combination Sum (LeetCode #39).
25. Backtracking on Grids — Word Search (LeetCode #79); N-Queens flagged as a stretch exercise.

**Unit 8: Dynamic Programming** (5 lessons — the largest unit; DP is the highest-value, hardest pattern for both motivations)
26. Memoization vs. Tabulation — Climbing Stairs (LeetCode #70), revisiting CP2's naive-recursive Fibonacci.
27. 1D DP Patterns — House Robber & Maximum Subarray (LeetCode #198, #53).
28. 2D DP: Grids and Edit Distance (LeetCode #62, #72).
29. Knapsack Patterns — Partition Equal Subset Sum (LeetCode #416).
30. Longest Increasing Subsequence & Sequence DP (LeetCode #300).

**Unit 9: Greedy, Bit Tricks & Bringing It Together** (4 lessons — capstone unit)
31. Greedy Algorithms & Interval Scheduling — Merge Intervals / Non-overlapping Intervals (LeetCode #56, #435); greedy vs. DP, how to tell which applies.
32. Bit Manipulation Essentials — XOR tricks, Single Number (LeetCode #136).
33. The Pattern Recognition Cheat Sheet — a decision framework synthesizing every pattern in the course ("when you see X, think Y").
34. Capstone: A Mock Walkthrough — Subarray Sum Equals K (LeetCode #560, hash map + prefix sum combined), applying Lesson 3's framework end to end; where to go next (segment trees, Codeforces, contest practice).

## Format conventions carried over
- Reuse `mountTabs` / `.fm-tabs` / `.fm-panel` for every 4-language code comparison, `pre.code-block` / `.code-bad` / `.code-good` for before/after contrast, exactly 5 quizzes per lesson (3 multiple-choice + 2 fill-in-blank), standard lesson skeleton (kicker, nav-links, box/box.why, "Go to the source", `.ask-teacher` closer).
- New this course: a "Practice on LeetCode" section per pattern lesson (after "Go to the source"), citing the real problem(s) by number and name with a direct link to `leetcode.com/problems/...`.
