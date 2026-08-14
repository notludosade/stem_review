// FRQ prompts and grading rubrics, kept server-side only — the client sends
// a questionId and a response, never the rubric itself, so there's nothing
// for a browser-side tamperer to read or edit to inflate a score.
const FRQ_QUESTIONS = {
  'roller-coaster-real-example': {
    concept:
      'The page shows that an idealized frictionless loop needs a starting height of at least h = 2.5r ' +
      '(r = loop radius) to keep a train in contact with the track at the top, from mgh = 1/2 m v^2 and the ' +
      'minimum-contact condition v^2/r = g. It also notes real coasters need more than this because of ' +
      'friction, air resistance, track flex, rider-acceleration limits, clothoid loop shapes, and regulatory ' +
      'safety factors — without giving specifics.',
    question:
      "Real roller coasters use well more than the 2.5r minimum calculated on this page. Pick one real, " +
      "currently or formerly operating roller coaster with a vertical loop. State its actual loop height " +
      "and radius (or height-to-radius ratio) if you can find them, and name at least one specific real " +
      "engineering safety practice — beyond what this page already covers — that theme parks use to keep " +
      "riders safe on loops. Cite what you find.",
    rubric: [
      'Names a real, identifiable roller coaster (not a generic or invented example).',
      "Gives a real height and/or radius figure for that coaster's loop, or explicitly says it could not be found and explains what it found instead.",
      'Names at least one concrete real-world safety practice not already described on the page (e.g. specific restraint systems, inspection regimes, G-force limits, track sensor systems) rather than repeating the page\'s own list.',
      'Reasoning is physically sound and consistent with the h ≥ 2.5r result from the page — does not contradict it without justification.',
      'Response reads as the student\'s own explanation, not a pasted block of search results.',
    ],
  },
};

function getFrqQuestion(id) {
  return FRQ_QUESTIONS[id] || null;
}

module.exports = { getFrqQuestion };
