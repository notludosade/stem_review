(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', api.mount);
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

  const mountAb = (widget) => {
    const readout = widget.querySelector('[data-readout]');
    const hint = widget.querySelector('[data-hint]');
    widget.querySelectorAll('[data-visitors]').forEach((button) => button.addEventListener('click', () => {
      const visitors = Number(button.dataset.visitors);
      const result = abResult(visitors);
      readout.textContent = `${visitors.toLocaleString()} visitors per group · Control: 10% · Treatment: 12% · z = ${result.z.toFixed(2)}`;
      hint.textContent = result.significant
        ? 'Statistically significant at the usual 5% two-sided threshold: this sample separates the signal from ordinary sampling noise.'
        : 'Not statistically significant: the observed lift is promising, but this sample is too small to distinguish it reliably from chance.';
    }));
  };

  const callScenarios = {
    healthy: ['Latency: 40 ms · Jitter: 5 ms · Packet loss: 0.2%', 'Audio and video should both remain smooth; the jitter buffer can absorb small timing variation.'],
    congested: ['Latency: 180 ms · Jitter: 90 ms · Packet loss: 8%', 'Video freezes or becomes blocky first because late and missing video packets cannot be displayed on time; audio can survive by using less bandwidth and concealing short gaps.'],
    tcp: ['Reliable delivery · Head-of-line waiting after loss', 'TCP replaces missing packets, but waiting for an old packet can stall newer video data. A real-time call usually prefers a small visible glitch over delayed conversation.']
  };
  const mountCall = (widget) => {
    const readout = widget.querySelector('[data-readout]');
    const hint = widget.querySelector('[data-hint]');
    widget.querySelectorAll('[data-call-scenario]').forEach((button) => button.addEventListener('click', () => {
      [readout.textContent, hint.textContent] = callScenarios[button.dataset.callScenario];
    }));
  };

  const mountCoaster = (widget) => {
    const readout = widget.querySelector('[data-readout]');
    const hint = widget.querySelector('[data-hint]');
    widget.querySelectorAll('[data-height]').forEach((button) => button.addEventListener('click', () => {
      const height = Number(button.dataset.height);
      const radius = Number(button.dataset.radius);
      const result = coasterResult(height, radius);
      readout.textContent = `Start height: ${height} m · Loop radius: ${radius} m · Top speed: ${result.topSpeed.toFixed(1)} m/s · Required: ${result.minimumSpeed.toFixed(1)} m/s`;
      hint.textContent = result.safe
        ? 'The idealized energy model keeps the train in contact at the top. Real designs require extra margin for friction, drag, uncertainty, and rider limits.'
        : 'Unsafe in the idealized model: gravity needs more inward acceleration than this speed provides, so the train can lose contact near the top.';
    }));
  };

  const mount = () => {
    document.querySelectorAll('[data-ab-widget]').forEach(mountAb);
    document.querySelectorAll('[data-call-widget]').forEach(mountCall);
    document.querySelectorAll('[data-coaster-widget]').forEach(mountCoaster);
  };

  return { abResult, coasterResult, mount };
}));
