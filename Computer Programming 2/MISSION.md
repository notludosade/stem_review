# Mission: Computer Programming 2

## Why
Computer Programming 1 covers the building blocks; this course is about what separates someone who can write a script from someone who can build and reason about real software — structuring data correctly, handling failure gracefully, and having a working sense of why one approach is faster or safer than another. The four-language comparison continues here specifically because the biggest payoff shows up at this level: seeing the *same* linked list or the *same* try/catch pattern implemented differently exposes what each language actually optimizes for.

## Success looks like
- Designs a class hierarchy with real inheritance/interfaces and explains when composition would have been the better choice instead.
- Chooses the right core data structure (stack, queue, linked list, hash map) for a given problem and explains the trade-off in plain terms, not just by name.
- Writes and traces a recursive function confidently, including reasoning about the call stack and when recursion is a bad fit versus a loop.
- Estimates the Big-O of a simple piece of code by inspection, and picks between linear search/bubble sort and binary search/merge sort appropriately.
- Handles errors deliberately (try/catch, custom exceptions) instead of letting programs crash uninformatively or fail silently — ties directly back to the "honest failure" lesson in Computer Programming Ethics.
- Explains, concretely, how memory is managed differently in a garbage-collected language (Python/Java/JavaScript) versus C++ (pointers, ownership, manual allocation) and what bugs each model is prone to.
- Writes at least a few real unit tests for a small program, and debugs using a debugger/print-tracing strategy rather than trial and error.

## Constraints
- Continues the four-language-in-parallel format from Computer Programming 1 (Python, Java, JavaScript, C++), same ordering, same shared components.
- Third course in the STEM+ "Computer Programming" strand — assumes everything from Computer Programming 1 (variables, control flow, functions, basic OOP) and Computer Programming Ethics (secure/honest defaults) without re-teaching them.
- No assigned textbook or standards body — self-designed sequence. See `NOTES.md` for the unit plan.

## Out of scope
- Formal algorithms/data-structures theory at a CS-degree depth (proofs of complexity, advanced tree/graph structures like AVL or B-trees) — this course builds working intuition and the most commonly used structures, not an algorithms-course-equivalent.
- AI/ML-specific data structures and workflows — deferred to the AI Developer course.
