(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', api.mount);
    else api.mount();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const abResult = (visitorsPerGroup, controlRate = 0.10, treatmentRate = 0.12) => {
    const pooled = (controlRate + treatmentRate) / 2;
    const standardError = Math.sqrt(pooled * (1 - pooled) * 2 / visitorsPerGroup);
    const z = (treatmentRate - controlRate) / standardError;
    return { z, significant: Math.abs(z) >= 1.96 };
  };

  const coasterResult = (startHeight, radius, gravity = 9.81) => {
    const topHeight = 2 * radius;
    const topSpeed = startHeight >= topHeight ? Math.sqrt(2 * gravity * (startHeight - topHeight)) : 0;
    const minimumSpeed = Math.sqrt(gravity * radius);
    return { topSpeed, minimumSpeed, safe: topSpeed >= minimumSpeed };
  };

  const cosineSimilarity = (left, right) => {
    const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
    const leftNorm = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0));
    const rightNorm = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0));
    return leftNorm && rightNorm ? dot / (leftNorm * rightNorm) : 0;
  };

  const sirStep = ({ susceptible, infected, recovered, beta, gamma, population }, days = 1) => {
    let s = susceptible;
    let i = infected;
    let r = recovered;
    for (let day = 0; day < days; day += 1) {
      const newInfections = Math.min(s, beta * s * i / population);
      const newRecoveries = Math.min(i, gamma * i);
      s -= newInfections;
      i += newInfections - newRecoveries;
      r += newRecoveries;
    }
    return { susceptible: s, infected: i, recovered: r, rEffective: (beta / gamma) * s / population };
  };

  const shortestPath = (edges, start, end) => {
    const graph = new Map();
    edges.forEach(([from, to, weight]) => {
      if (!graph.has(from)) graph.set(from, []);
      if (!graph.has(to)) graph.set(to, []);
      graph.get(from).push([to, weight]);
      graph.get(to).push([from, weight]);
    });
    const distances = new Map(Array.from(graph.keys(), (node) => [node, Infinity]));
    const previous = new Map();
    const unvisited = new Set(graph.keys());
    distances.set(start, 0);
    while (unvisited.size) {
      let current = null;
      unvisited.forEach((node) => {
        if (current === null || distances.get(node) < distances.get(current)) current = node;
      });
      if (current === end || distances.get(current) === Infinity) break;
      unvisited.delete(current);
      (graph.get(current) || []).forEach(([neighbor, weight]) => {
        if (!unvisited.has(neighbor)) return;
        const candidate = distances.get(current) + weight;
        if (candidate < distances.get(neighbor)) {
          distances.set(neighbor, candidate);
          previous.set(neighbor, current);
        }
      });
    }
    if (!distances.has(end) || distances.get(end) === Infinity) return { distance: Infinity, path: [] };
    const path = [];
    for (let node = end; node !== undefined; node = previous.get(node)) path.unshift(node);
    return { distance: distances.get(end), path };
  };

  const adverseImpact = (groupSelected, groupApplicants, referenceSelected, referenceApplicants) => {
    const groupRate = groupApplicants ? groupSelected / groupApplicants : 0;
    const referenceRate = referenceApplicants ? referenceSelected / referenceApplicants : 0;
    const ratio = referenceRate ? groupRate / referenceRate : 0;
    return { groupRate, referenceRate, ratio, passesFourFifths: ratio >= 0.8 };
  };

  const orbitResult = (altitudeKm, earthRadiusKm = 6371, mu = 398600.4418) => {
    const radiusKm = earthRadiusKm + altitudeKm;
    const speedKmS = Math.sqrt(mu / radiusKm);
    const periodSeconds = 2 * Math.PI * Math.sqrt(radiusKm ** 3 / mu);
    return { radiusKm, speedKmS, periodSeconds };
  };

  const bindWidget = (widget, selector, handler) => {
    if (widget.dataset.applicationReady) return;
    widget.dataset.applicationReady = '1';
    widget.querySelectorAll(selector).forEach((button) => button.addEventListener('click', () => handler(button)));
  };

  const mountAb = (widget) => bindWidget(widget, '[data-visitors]', (button) => {
    const visitors = Number(button.dataset.visitors);
    const result = abResult(visitors);
    widget.querySelector('[data-readout]').textContent = `${visitors.toLocaleString()} visitors per group · Control: 10% · Treatment: 12% · z = ${result.z.toFixed(2)}`;
    widget.querySelector('[data-hint]').textContent = result.significant
      ? 'Statistically significant at the usual 5% two-sided threshold: this sample separates the signal from ordinary sampling noise.'
      : 'Not statistically significant: the observed lift is promising, but this sample is too small to distinguish it reliably from chance.';
  });

  const callScenarios = {
    healthy: ['Latency: 40 ms · Jitter: 5 ms · Packet loss: 0.2%', 'Audio and video should both remain smooth; the jitter buffer can absorb small timing variation.'],
    congested: ['Latency: 180 ms · Jitter: 90 ms · Packet loss: 8%', 'Video freezes or becomes blocky first because late and missing video packets cannot be displayed on time; audio can survive by using less bandwidth and concealing short gaps.'],
    tcp: ['Reliable delivery · Head-of-line waiting after loss', 'TCP replaces missing packets, but waiting for an old packet can stall newer video data. A real-time call usually prefers a small visible glitch over delayed conversation.']
  };
  const mountCall = (widget) => bindWidget(widget, '[data-call-scenario]', (button) => {
    [widget.querySelector('[data-readout]').textContent, widget.querySelector('[data-hint]').textContent] = callScenarios[button.dataset.callScenario];
  });

  const mountCoaster = (widget) => bindWidget(widget, '[data-height]', (button) => {
    const height = Number(button.dataset.height);
    const radius = Number(button.dataset.radius);
    const result = coasterResult(height, radius);
    widget.querySelector('[data-readout]').textContent = `Start height: ${height} m · Loop radius: ${radius} m · Top speed: ${result.topSpeed.toFixed(1)} m/s · Required: ${result.minimumSpeed.toFixed(1)} m/s`;
    widget.querySelector('[data-hint]').textContent = result.safe
      ? 'The idealized energy model keeps the train in contact at the top. Real designs require extra margin for friction, drag, uncertainty, and rider limits.'
      : 'Unsafe in the idealized model: gravity needs more inward acceleration than this speed provides, so the train can lose contact near the top.';
  });

  const recommendationProfiles = {
    scienceFiction: { user: [5, 1, 4], label: 'science-fiction fan' },
    broadTaste: { user: [3, 3, 3], label: 'broad taste' },
    comedy: { user: [1, 5, 1], label: 'comedy fan' }
  };
  const recommendationItems = [
    { name: 'Orbital', vector: [5, 0, 4] },
    { name: 'Quick Laughs', vector: [1, 5, 0] },
    { name: 'Mixed Signals', vector: [3, 3, 2] }
  ];
  const mountRecommendation = (widget) => bindWidget(widget, '[data-rec-profile]', (button) => {
    const profile = recommendationProfiles[button.dataset.recProfile];
    const scores = recommendationItems.map((item) => ({ name: item.name, score: cosineSimilarity(profile.user, item.vector) }))
      .sort((a, b) => b.score - a.score);
    widget.querySelector('[data-readout]').textContent = `${profile.label}: ${scores.map((item) => `${item.name} ${item.score.toFixed(3)}`).join(' · ')}`;
    widget.querySelector('[data-hint]').textContent = `Recommend ${scores[0].name}: its feature vector points in the most similar direction to the user's profile.`;
  });

  const epidemicScenarios = {
    early: { susceptible: 9900, infected: 100, recovered: 0, beta: 0.30, gamma: 0.10, population: 10000 },
    threshold: { susceptible: 3333, infected: 100, recovered: 6567, beta: 0.30, gamma: 0.10, population: 10000 },
    controlled: { susceptible: 2500, infected: 100, recovered: 7400, beta: 0.24, gamma: 0.12, population: 10000 }
  };
  const mountEpidemic = (widget) => bindWidget(widget, '[data-epidemic]', (button) => {
    const state = epidemicScenarios[button.dataset.epidemic];
    const result = sirStep(state);
    const change = result.infected - state.infected;
    widget.querySelector('[data-readout]').textContent = `Rₑ = ${result.rEffective.toFixed(2)} · infected after one model-day: ${result.infected.toFixed(1)} (${change >= 0 ? '+' : ''}${change.toFixed(1)})`;
    widget.querySelector('[data-hint]').textContent = result.rEffective > 1
      ? 'Each infectious person is replacing themselves with more than one new infection on average, so infections grow in this local model.'
      : 'Rₑ is at or below 1, so the infectious population is level or shrinking in this local model.';
  });

  const routeScenarios = {
    normal: [['A', 'B', 4], ['A', 'C', 2], ['C', 'B', 1], ['B', 'D', 5], ['C', 'D', 8], ['D', 'E', 2], ['B', 'E', 9]],
    traffic: [['A', 'B', 4], ['A', 'C', 2], ['C', 'B', 1], ['B', 'D', 12], ['C', 'D', 4], ['D', 'E', 2], ['B', 'E', 9]],
    closure: [['A', 'B', 4], ['A', 'C', 2], ['B', 'D', 5], ['C', 'D', 8], ['D', 'E', 2], ['B', 'E', 9]]
  };
  const mountRoute = (widget) => bindWidget(widget, '[data-route]', (button) => {
    const result = shortestPath(routeScenarios[button.dataset.route], 'A', 'E');
    widget.querySelector('[data-readout]').textContent = `Best route: ${result.path.join(' → ')} · total travel cost: ${result.distance}`;
    widget.querySelector('[data-hint]').textContent = 'Dijkstra’s algorithm revisits the decision when edge costs change; “shortest” means lowest total weight, not fewest roads.';
  });

  const hiringScenarios = {
    balanced: [48, 80, 63, 100],
    warning: [36, 80, 65, 100],
    severe: [24, 80, 70, 100]
  };
  const mountHiring = (widget) => bindWidget(widget, '[data-hiring]', (button) => {
    const result = adverseImpact(...hiringScenarios[button.dataset.hiring]);
    widget.querySelector('[data-readout]').textContent = `Group rate: ${(100 * result.groupRate).toFixed(1)}% · reference rate: ${(100 * result.referenceRate).toFixed(1)}% · ratio: ${(100 * result.ratio).toFixed(1)}%`;
    widget.querySelector('[data-hint]').textContent = result.passesFourFifths
      ? 'This screen does not trigger the four-fifths rule, but that alone does not prove the model is fair or lawful.'
      : 'This screen triggers the four-fifths warning and needs investigation; the ratio is evidence for review, not automatic proof of discrimination.';
  });

  const mountOrbit = (widget) => bindWidget(widget, '[data-altitude]', (button) => {
    const altitude = Number(button.dataset.altitude);
    const result = orbitResult(altitude);
    const period = result.periodSeconds < 7200
      ? `${(result.periodSeconds / 60).toFixed(1)} minutes`
      : `${(result.periodSeconds / 3600).toFixed(2)} hours`;
    widget.querySelector('[data-readout]').textContent = `Altitude: ${altitude.toLocaleString()} km · speed: ${result.speedKmS.toFixed(2)} km/s · period: ${period}`;
    widget.querySelector('[data-hint]').textContent = 'Higher circular orbits move more slowly but travel a longer circumference, so their periods are much longer.';
  });

  const mount = () => {
    document.querySelectorAll('[data-ab-widget]').forEach(mountAb);
    document.querySelectorAll('[data-call-widget]').forEach(mountCall);
    document.querySelectorAll('[data-coaster-widget]').forEach(mountCoaster);
    document.querySelectorAll('[data-recommendation-widget]').forEach(mountRecommendation);
    document.querySelectorAll('[data-epidemic-widget]').forEach(mountEpidemic);
    document.querySelectorAll('[data-route-widget]').forEach(mountRoute);
    document.querySelectorAll('[data-hiring-widget]').forEach(mountHiring);
    document.querySelectorAll('[data-orbit-widget]').forEach(mountOrbit);
  };

  return { abResult, coasterResult, cosineSimilarity, sirStep, shortestPath, adverseImpact, orbitResult, mount };
}));
