# AI Developer Resources

## Knowledge

- [3Blue1Brown — Neural Networks (YouTube series)](https://www.3blue1brown.com/topics/neural-networks)
  Visually-driven, rigorous-but-intuitive walkthrough of how neural networks actually learn: forward pass, gradient descent, backpropagation, and (in the later videos) the transformer/attention mechanism behind modern LLMs. Use for: the entire neural-network-fundamentals and deep-learning-architecture units — this is the primary explainer to point learners to.
- [Machine Learning Specialization — Andrew Ng / DeepLearning.AI (Coursera)](https://www.coursera.org/specializations/machine-learning-introduction)
  The standard, widely-trusted entry point to classical ML (regression, classification, evaluation), free to audit. Use for: the classical-ML unit — cite specific lecture concepts rather than assuming familiarity.
- [Michael Nielsen — Neural Networks and Deep Learning (free online book)](http://neuralnetworksanddeeplearning.com/)
  Free, rigorous, step-by-step text covering exactly how networks train, with worked math. Use for: a deeper, readable-at-your-own-pace alternative/supplement to 3Blue1Brown for the same material.
- [DeepLearning.AI short courses](https://www.deeplearning.ai/courses)
  Many free, focused courses on specific applied skills (structured LLM outputs, RAG, deployment, evaluation). Use for: the pretrained-models/API and deployment units — these map almost one-to-one onto specific short courses there.
- [Weights & Biases — Building LLM-Powered Apps (free course)](https://www.wandb.courses/courses/building-llm-powered-apps)
  A genuinely free, hands-on course on building real LLM applications (APIs, chains, prompt engineering, evaluation), taught by a practicing AI engineer. Use for: the "building a real AI application" unit — the closest thing to a direct template for that unit's capstone project.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  The security/safety-risk counterpart to the general OWASP Top 10, specific to LLM-powered apps (prompt injection, data leakage, excessive agency). Use for: the responsible-AI unit, paired with `[[../Computer Programming Ethics/RESOURCES.md]]`.

## Wisdom (Communities)

- [r/MachineLearning](https://www.reddit.com/r/MachineLearning/)
  Large, mixed practitioner/researcher community — higher signal for genuinely technical ML questions than most general AI subs.
- [r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/)
  Hands-on, build-focused community specifically around running and building with real models (not just theory). Use for: practical deployment/tooling questions once past the foundational units.

## Gaps

- No single free resource covers classical ML → deep learning → LLM application-building → deployment as one continuous track — this course's unit sequence stitches together the sources above rather than following one existing curriculum end to end. Revisit each unit's citations as the field moves (this space changes fast).
