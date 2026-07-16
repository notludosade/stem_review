# Mission: AI Developer

## Why
Programming fluency (Computer Programming 1 & 2) plus an ethical foundation (Computer Programming Ethics) should culminate in being able to actually build and ship something with AI in it — not just describe how a neural network works in the abstract, but take a real problem, choose the right AI approach, build it, and put it in front of real users responsibly. This is the capstone course of the STEM+ Computer Programming strand.

## Success looks like
- Can explain, correctly and without hand-waving, the difference between AI, machine learning, and deep learning, and where a given real-world tool actually falls.
- Understands a dataset well enough to clean it, split it properly (train/validation/test), and explain what "overfitting" means using their own data as the example.
- Can train and evaluate a basic classical ML model (e.g. logistic regression or a decision tree) and correctly interpret accuracy/precision/recall for the problem at hand.
- Has enough working intuition for how a neural network learns (forward pass, loss, gradient descent, backpropagation) to explain it to someone else without reciting the math from memory.
- Knows, at a working level, what a CNN, an RNN, and a Transformer are each good at — and why the Transformer became the backbone of modern LLMs.
- Can call a real LLM API, use embeddings, write an effective prompt, and explain when fine-tuning versus retrieval-augmented generation (RAG) is the right tool.
- Has actually built and deployed one small, real AI-powered application end to end — not a tutorial copy-paste, but a project they chose and can explain every part of.
- Can name the concrete risks of what they just built (bias, hallucination, safety, when a human needs to stay in the loop) and point to a mitigation for each — directly continuing the ethics lens from Computer Programming Ethics.

## Constraints
- Final course in the STEM+ "Computer Programming" strand — assumes solid general programming fluency (Computer Programming 1 & 2) and the ethical defaults from Computer Programming Ethics; doesn't re-teach either.
- Balances theory and hands-on build work deliberately: enough foundational ML/DL to not be "just an API wrapper" course, but the course exists to get to a real, deployed project, not to substitute for a full ML degree.
- No assigned textbook or standards body — self-designed sequence informed by [DeepLearning.AI](https://www.deeplearning.ai/courses), the [3Blue1Brown neural networks series](https://www.3blue1brown.com/topics/neural-networks), and [Weights & Biases' "Building LLM-Powered Apps"](https://www.wandb.courses/courses/building-llm-powered-apps). See `NOTES.md` for the unit plan.

## Out of scope
- Training large models from scratch, or deep infrastructure/MLOps at scale (distributed training, custom accelerator programming) — this course uses pretrained models and small-scale training, matching what an individual developer can realistically do.
- Research-level theory (novel architecture design, proving convergence guarantees) — the goal is competent applied practice, not research.
