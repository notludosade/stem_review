(function () {
  'use strict';

  var apiPromise;
  var STANDALONE = {
    graphing: 'https://www.desmos.com/calculator',
    scientific: 'https://www.desmos.com/scientific',
  };

  function fallback(element, message) {
    var type = element.dataset.desmos || 'graphing';
    element.classList.add('desmos-fallback');
    element.innerHTML = '';
    var text = document.createElement('p');
    text.textContent = message + ' ';
    var link = document.createElement('a');
    link.href = STANDALONE[type];
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open the Desmos ' + type + ' calculator instead.';
    text.appendChild(link);
    element.appendChild(text);
  }

  function apiKey() {
    var meta = document.querySelector('meta[name="desmos-api-key"]');
    return meta && meta.content.trim();
  }

  function loadApi() {
    if (window.Desmos) return Promise.resolve(window.Desmos);
    if (apiPromise) return apiPromise;
    var key = apiKey();
    if (!key) return Promise.reject(new Error('missing-key'));
    apiPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://www.desmos.com/api/v1.11/calculator.js?apiKey=' + encodeURIComponent(key);
      script.async = true;
      script.onload = function () { window.Desmos ? resolve(window.Desmos) : reject(new Error('missing-api')); };
      script.onerror = function () { reject(new Error('network')); };
      document.head.appendChild(script);
    });
    return apiPromise;
  }

  function expressionsFor(element) {
    var source = element.querySelector('[data-desmos-expressions]');
    if (!source) return [];
    try { return JSON.parse(source.textContent || '[]'); } catch (_) { return []; }
  }

  function mount(element, Desmos) {
    var type = element.dataset.desmos;
    var feature = type === 'scientific' ? 'ScientificCalculator' : 'GraphingCalculator';
    if (Desmos.enabledFeatures && Desmos.enabledFeatures[feature] === false) {
      fallback(element, 'This calculator is not enabled for the configured Desmos key.');
      return;
    }
    var expressions = expressionsFor(element);
    element.replaceChildren();
    try {
      var calculator = Desmos[feature](element, {
        settingsMenu: true,
        links: true,
        autosize: true,
        decimalToFraction: true,
      });
      if (type === 'graphing') expressions.forEach(function (expression) { calculator.setExpression(expression); });
      element._stemDesmos = calculator;
    } catch (_) {
      fallback(element, 'The embedded calculator could not start.');
    }
  }

  function mountAll(root) {
    var elements = Array.prototype.slice.call((root || document).querySelectorAll('[data-desmos]'));
    if (!elements.length) return Promise.resolve([]);
    return loadApi().then(function (Desmos) {
      elements.forEach(function (element) { mount(element, Desmos); });
      return elements;
    }).catch(function (error) {
      var message = error.message === 'missing-key'
        ? 'The embedded calculator is not configured yet.'
        : 'The embedded calculator is temporarily unavailable.';
      elements.forEach(function (element) { fallback(element, message); });
      return [];
    });
  }

  window.STEMDesmos = { mountAll: mountAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mountAll(document); });
  else mountAll(document);
}());
