# Mission: Computer Programming Ethics

## Why
Before writing serious code in Python, Java, JavaScript, or C++, want the ethical defaults in place first — so secure, honest, fair, and legally sound choices become habit from lesson one of the Computer Programming sequence, not a review pass bolted onto finished projects later. The practical goal is to be able to look at a piece of code and say concretely why it is or isn't trustworthy, not just recite abstract principles.

## Success looks like
- Given a short, real snippet, can point to the exact line where an ethical failure lives (an injection risk, a silently swallowed error, an over-collected field) and name the fix.
- Recognizes the standard classes of insecure code (injection, buffer/bounds issues, unvalidated input, leaked secrets) on sight in Python, Java, JavaScript, and C++.
- Applies data-minimization and consent thinking by default to any code that touches user data.
- Can tell honest failure handling (clear errors, honest logs) apart from failure-hiding (silent catches, misleading messages, dark patterns) and explains why the difference matters to a user.
- Checks a dependency's license and gives correct attribution before pulling in someone else's code.
- Treats readability, tests, and documentation as part of the ethical obligation of shipping code — "auditable" is a design goal, not polish.

## Constraints
- Grounded in real code, not abstract philosophy — every claim needs a concrete snippet showing the failure mode, drawn from Python, Java, JavaScript, or C++ (per the user's request: one unified course, illustrated across all four).
- First course in the STEM+ "Computer Programming" strand: Ethics → Computer Programming 1 → Computer Programming 2 → AI Developer. It comes before the syntax-heavy courses on purpose.
- No assigned textbook or standards body the way AP Calc has the College Board CED — sequence is self-designed against professional norms ([ACM Code of Ethics](https://www.acm.org/code-of-ethics), the [ACM/IEEE-CS Software Engineering Code](https://www.acm.org/code-of-ethics/software-engineering-code), [OWASP Top 10](https://owasp.org/Top10/2021/)) and real-world incidents. See `NOTES.md` for the unit plan.

## Out of scope
- General programming syntax/fundamentals — that's Computer Programming 1. This course assumes only enough code literacy to read a short snippet, not to write one from scratch.
- AI-specific ethics (model bias, hallucination, model safety) — deferred to the AI Developer course, where it's grounded in actual model-building context rather than discussed abstractly here.
