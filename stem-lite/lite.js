(function () {
  'use strict';
  var body = document.body;
  var root = body.dataset.liteRoot || './';

  document.querySelectorAll('[data-project-content]').forEach(function (element) { element.hidden = false; });
  document.querySelectorAll('[data-project-locked]').forEach(function (element) { element.hidden = true; });
  document.querySelectorAll('.reflection-actions').forEach(function (element) {
    element.innerHTML = '<p class="lite-note">Reflection fields are private scratch space in STEM Lite and are not saved or graded.</p>';
  });
  document.querySelectorAll('[data-frq]').forEach(function (element) {
    element.querySelectorAll('[data-frq-submit], [data-frq-result], [data-frq-status]').forEach(function (control) { control.remove(); });
    var note = document.createElement('p');
    note.className = 'lite-note';
    note.textContent = 'Use this as an open reflection prompt. STEM Lite does not provide AI grading.';
    element.appendChild(note);
  });

  window.addEventListener('keydown', function (event) {
    var target = event.target;
    var typing = target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
    if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !typing)) {
      if (!document.querySelector('[data-lite-search]')) {
        event.preventDefault();
        window.location.assign(root + 'search.html');
      }
    }
  });

  var mount = document.querySelector('[data-lite-search]');
  if (!mount) return;
  var input = mount.querySelector('input');
  var resultsElement = mount.querySelector('[data-lite-results]');
  var suggestions = ['chain rule', 'satellite', 'python', 'linear algebra'];
  var entries = [];
  var displayed = [];
  var active = 0;
  var GROUPS = ['LESSON', 'PRACTICE', 'COURSE', 'SKILL', 'APPLICATION', 'PROJECT', 'CALCULATOR', 'PAGE', 'RELATED'];

  function appendHighlighted(parent, text, terms) {
    var normalized = (terms || []).filter(Boolean).sort(function (a, b) { return b.length - a.length; });
    if (!normalized.length) { parent.textContent = text; return; }
    var pattern = normalized.map(function (term) { return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');
    var expression = new RegExp('(' + pattern + ')', 'gi');
    text.split(expression).forEach(function (part) {
      var matched = normalized.some(function (term) { return part.toLowerCase() === term.toLowerCase(); });
      var node = matched ? document.createElement('mark') : document.createTextNode(part);
      if (matched) node.textContent = part;
      parent.appendChild(node);
    });
  }

  function showSuggestions(message) {
    resultsElement.replaceChildren();
    var text = document.createElement('p');
    text.textContent = message;
    resultsElement.appendChild(text);
    var row = document.createElement('div');
    row.className = 'lite-suggestions';
    suggestions.forEach(function (value) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = value;
      button.addEventListener('click', function () { input.value = value; render(); input.focus(); });
      row.appendChild(button);
    });
    resultsElement.appendChild(row);
  }

  function render() {
    var query = input.value.trim();
    if (!query) { displayed = []; showSuggestions('Search courses, lessons, skills, practice, applications, projects, and calculators.'); return; }
    var found = window.STEMPlusSearch.searchIndex(entries, query, entries.length);
    if (!found.length) { displayed = []; showSuggestions('No results. Try a broader search or one of these suggestions.'); return; }
    resultsElement.replaceChildren();
    displayed = [];
    GROUPS.forEach(function (group) {
      var matches = found.filter(function (entry) { return (entry.label || entry.type) === group; }).slice(0, 5);
      if (!matches.length) return;
      var section = document.createElement('section');
      section.className = 'lite-search-group';
      var heading = document.createElement('h2');
      heading.textContent = group;
      section.appendChild(heading);
      matches.forEach(function (entry) {
        var link = document.createElement('a');
        link.className = 'lite-search-result';
        link.href = root + entry.href;
        link.dataset.searchIndex = String(displayed.length);
        appendHighlighted(link, entry.title, entry.matchTerms);
        if (entry.context) {
          var context = document.createElement('small');
          appendHighlighted(context, entry.context, entry.matchTerms);
          link.appendChild(context);
        }
        section.appendChild(link);
        displayed.push(link);
      });
      resultsElement.appendChild(section);
    });
    active = 0;
    if (displayed[0]) displayed[0].classList.add('is-active');
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', function (event) {
    if (!displayed.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      displayed[active].classList.remove('is-active');
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + displayed.length) % displayed.length;
      displayed[active].classList.add('is-active');
      displayed[active].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      displayed[active].click();
    }
  });

  Promise.all([
    fetch(root + 'assets/search-index.json').then(function (response) { return response.json(); }),
    new Promise(function (resolve) {
      if (window.STEMPlusSearch) resolve();
      else window.addEventListener('load', resolve, { once: true });
    }),
  ]).then(function (values) {
    entries = values[0];
    showSuggestions('Search the public STEM Lite catalog, or try one of these.');
    input.focus();
  }).catch(function () { showSuggestions('Search is temporarily unavailable. Browse the sections above instead.'); });
}());
