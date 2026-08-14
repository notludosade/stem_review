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
    // Reference-quality answer for developer QA — deliberately admits what
    // it couldn't pin down (an exact loop radius) rather than inventing a
    // precise-sounding number, since the whole point of this feature is
    // penalizing confident-but-wrong "real" facts.
    sampleAnswer:
      "Full Throttle at Six Flags Magic Mountain has a vertical loop — it was the world's tallest complete " +
      "loop coaster when it opened in 2013, with the loop itself reported around 45 meters tall. I couldn't " +
      "pin down a reliable loop radius, so I can't compute an exact height-to-radius ratio, but the loop " +
      "height alone is far beyond what a 2.5r frictionless model would require for any reasonably-sized " +
      "radius, which fits the page's point that real coasters need a large margin above the idealized " +
      "minimum. Beyond what the page already covers, parks like Six Flags use non-destructive testing — " +
      "ultrasonic and magnetic-particle inspection of welds and axles — between operating seasons to catch " +
      "fatigue cracks before they cause a failure, which the simple energy-conservation model has no way to " +
      "account for at all.",
  },
};

function getFrqQuestion(id) {
  return FRQ_QUESTIONS[id] || null;
}

module.exports = { getFrqQuestion };
