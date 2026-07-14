// STEM+ shared interactive widgets. Vanilla JS, no dependencies, no external calls.
// Each mount function wires DOM elements the lesson HTML already provides; math and
// presentation stay in the lesson's own inline script, passed in via callbacks.
window.STEMPlus = (function () {
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function clientToSvgX(svg, evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse()).x;
  }

  function clientToSvgY(svg, evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse()).y;
  }

  // Live-evaluates a JS function as the user types a number into an input.
  // container needs: [data-fm-input], [data-fm-output], optionally [data-fm-steps]
  function mountFunctionMachine(container, fn, opts) {
    opts = opts || {};
    const input = container.querySelector('[data-fm-input]');
    const output = container.querySelector('[data-fm-output]');
    const steps = container.querySelector('[data-fm-steps]');
    const format = opts.format || ((v) => Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : 'undefined');

    const render = () => {
      const raw = input.value.trim();
      if (raw === '') { output.textContent = '?'; if (steps) steps.textContent = ''; return; }
      const x = Number(raw);
      if (!Number.isFinite(x)) { output.textContent = '?'; if (steps) steps.textContent = 'Enter a number.'; return; }
      let y;
      try { y = fn(x); } catch (e) { y = NaN; }
      output.textContent = format(y);
      if (steps && opts.step) steps.textContent = opts.step(x, y);
    };

    input.addEventListener('input', render);
    render();
    return { render };
  }

  // Draggable point constrained to y = fn(x) over [xMin, xMax] on a math<->svg linear transform.
  // opts: { fn, xMin, xMax, originX, originY, scaleX, scaleY, point, dragSurface, initialX, onUpdate(mathX, mathY) }
  function mountPointOnCurve(svg, opts) {
    const { fn, xMin, xMax, originX, originY, scaleX, scaleY, point } = opts;
    const surface = opts.dragSurface || svg;
    const toSvgX = (mx) => originX + mx * scaleX;
    const toSvgY = (my) => originY - my * scaleY;
    const toMathX = (sx) => (sx - originX) / scaleX;

    const update = (mathX) => {
      mathX = clamp(mathX, xMin, xMax);
      const mathY = fn(mathX);
      point.setAttribute('cx', toSvgX(mathX));
      point.setAttribute('cy', toSvgY(mathY));
      if (opts.onUpdate) opts.onUpdate(mathX, mathY);
    };

    let dragging = false;
    const start = (e) => { dragging = true; surface.setPointerCapture(e.pointerId); update(toMathX(clientToSvgX(svg, e))); };
    const move = (e) => { if (dragging) update(toMathX(clientToSvgX(svg, e))); };
    const end = () => { dragging = false; };

    surface.addEventListener('pointerdown', start);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);

    update(opts.initialX !== undefined ? opts.initialX : xMin);
    return { setX: update };
  }

  // Draggable vertical line, purely in SVG-pixel space (no math transform needed —
  // crossingsAt receives/returns raw SVG coordinates, since this widget only needs
  // to report *how many* crossings there are, not calibrated axis values).
  // opts: { xMin, xMax, initialX, line, points: [circleEls], dragSurface, crossingsAt(svgX) -> [svgY,...], onUpdate(svgX, ys) }
  function mountVerticalLineTest(svg, opts) {
    const { xMin, xMax, line, points, crossingsAt } = opts;
    const surface = opts.dragSurface || svg;

    const update = (x) => {
      x = clamp(x, xMin, xMax);
      line.setAttribute('x1', x); line.setAttribute('x2', x);
      const ys = crossingsAt(x);
      points.forEach((p, i) => {
        if (ys[i] !== undefined) {
          p.setAttribute('cx', x); p.setAttribute('cy', ys[i]);
          p.style.display = '';
        } else {
          p.style.display = 'none';
        }
      });
      if (opts.onUpdate) opts.onUpdate(x, ys);
    };

    let dragging = false;
    const start = (e) => { dragging = true; surface.setPointerCapture(e.pointerId); update(clientToSvgX(svg, e)); };
    const move = (e) => { if (dragging) update(clientToSvgX(svg, e)); };
    const end = () => { dragging = false; };

    surface.addEventListener('pointerdown', start);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);

    update(opts.initialX !== undefined ? opts.initialX : (xMin + xMax) / 2);
    return { setX: update };
  }

  // Two independently draggable points on the same y = fn(x) curve — pointerdown grabs
  // whichever point (A or B) is nearer the click, so a single shared drag surface works.
  // opts: { fn, xMin, xMax, originX, originY, scaleX, scaleY, pointA, pointB, dragSurface,
  //         initialXA, initialXB, onUpdate(mathXA, mathYA, mathXB, mathYB) }
  function mountTwoPointsOnCurve(svg, opts) {
    const { fn, xMin, xMax, originX, originY, scaleX, scaleY, pointA, pointB } = opts;
    const surface = opts.dragSurface || svg;
    const toSvgX = (mx) => originX + mx * scaleX;
    const toSvgY = (my) => originY - my * scaleY;
    const toMathX = (sx) => (sx - originX) / scaleX;

    let ax = opts.initialXA !== undefined ? opts.initialXA : xMin;
    let bx = opts.initialXB !== undefined ? opts.initialXB : xMax;
    let active = null;

    const place = (point, mx) => {
      const my = fn(mx);
      point.setAttribute('cx', toSvgX(mx));
      point.setAttribute('cy', toSvgY(my));
      return my;
    };

    const render = () => {
      const ay = place(pointA, ax);
      const by = place(pointB, bx);
      if (opts.onUpdate) opts.onUpdate(ax, ay, bx, by);
    };

    const start = (e) => {
      const mx = clamp(toMathX(clientToSvgX(svg, e)), xMin, xMax);
      active = Math.abs(mx - ax) <= Math.abs(mx - bx) ? 'a' : 'b';
      surface.setPointerCapture(e.pointerId);
      drag(e);
    };
    const drag = (e) => {
      if (!active) return;
      const mx = clamp(toMathX(clientToSvgX(svg, e)), xMin, xMax);
      if (active === 'a') ax = mx; else bx = mx;
      render();
    };
    const end = () => { active = null; };

    surface.addEventListener('pointerdown', start);
    surface.addEventListener('pointermove', drag);
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);

    render();
    return { render };
  }

  // Draggable horizontal line, mirroring mountVerticalLineTest but along y.
  // opts: { yMin, yMax, initialY, line, points, dragSurface, crossingsAt(svgY) -> [svgX,...], onUpdate(svgY, xs) }
  function mountHorizontalLineTest(svg, opts) {
    const { yMin, yMax, line, points, crossingsAt } = opts;
    const surface = opts.dragSurface || svg;

    const update = (y) => {
      y = clamp(y, yMin, yMax);
      line.setAttribute('y1', y); line.setAttribute('y2', y);
      const xs = crossingsAt(y);
      points.forEach((p, i) => {
        if (xs[i] !== undefined) {
          p.setAttribute('cy', y); p.setAttribute('cx', xs[i]);
          p.style.display = '';
        } else {
          p.style.display = 'none';
        }
      });
      if (opts.onUpdate) opts.onUpdate(y, xs);
    };

    let dragging = false;
    const start = (e) => { dragging = true; surface.setPointerCapture(e.pointerId); update(clientToSvgY(svg, e)); };
    const move = (e) => { if (dragging) update(clientToSvgY(svg, e)); };
    const end = () => { dragging = false; };

    surface.addEventListener('pointerdown', start);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);

    update(opts.initialY !== undefined ? opts.initialY : (yMin + yMax) / 2);
    return { setY: update };
  }

  // Live-redraws a polyline as y = fn(x) whenever setFn is called with a new fn — the
  // primitive behind any "drag a slider, watch the curve move" widget.
  // opts: { xMin, xMax, samples, originX, originY, scaleX, scaleY }
  function mountLiveCurve(polyline, opts) {
    const { xMin, xMax, originX, originY, scaleX, scaleY } = opts;
    const samples = opts.samples || 40;
    const toSvgX = (mx) => originX + mx * scaleX;
    const toSvgY = (my) => originY - my * scaleY;

    const setFn = (fn) => {
      const pts = [];
      for (let i = 0; i <= samples; i++) {
        const mx = xMin + (xMax - xMin) * (i / samples);
        let my;
        try { my = fn(mx); } catch (e) { my = NaN; }
        if (!Number.isFinite(my)) continue;
        pts.push(toSvgX(mx) + ',' + toSvgY(my));
      }
      polyline.setAttribute('points', pts.join(' '));
    };

    return { setFn };
  }

  // Live-evaluates a two-stage composition (f after g) as the user types a number.
  // container needs: [data-comp-input], [data-comp-mid], [data-comp-output], optionally [data-comp-steps]
  function mountComposition(container, g, f, opts) {
    opts = opts || {};
    const input = container.querySelector('[data-comp-input]');
    const mid = container.querySelector('[data-comp-mid]');
    const output = container.querySelector('[data-comp-output]');
    const steps = container.querySelector('[data-comp-steps]');
    const format = opts.format || ((v) => Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : 'undefined');

    const render = () => {
      const raw = input.value.trim();
      if (raw === '') { mid.textContent = '?'; output.textContent = '?'; if (steps) steps.textContent = ''; return; }
      const x = Number(raw);
      if (!Number.isFinite(x)) { mid.textContent = '?'; output.textContent = '?'; if (steps) steps.textContent = 'Enter a number.'; return; }
      let gx, fgx;
      try { gx = g(x); } catch (e) { gx = NaN; }
      try { fgx = f(gx); } catch (e) { fgx = NaN; }
      mid.textContent = format(gx);
      output.textContent = format(fgx);
      if (steps && opts.step) steps.textContent = opts.step(x, gx, fgx);
    };

    input.addEventListener('input', render);
    render();
    return { render };
  }

  // Wires a row of [tabAttr] buttons to show/hide a matching set of [panelAttr] panels.
  function mountTabs(container, tabAttr, panelAttr) {
    const tabs = container.querySelectorAll('[' + tabAttr + ']');
    const panels = container.querySelectorAll('[' + panelAttr + ']');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const target = tab.getAttribute(tabAttr);
        panels.forEach((p) => { p.hidden = p.getAttribute(panelAttr) !== target; });
      });
    });
  }

  const defaultLimitFormat = (v) => Number.isFinite(v) ? String(Math.round(v * 100000) / 100000) : 'undefined';

  // Two-sided numeric limit table: a slider steps through shrinking distances from c,
  // appending a row to each side's <tbody> every step so earlier (coarser) rows stay
  // visible — the point is to *watch* both sides converge, not just see the final row.
  // container needs: [data-limit-slider] (range input), [data-limit-left] and
  // [data-limit-right] (tbody elements). opts: { c, distances, format, onRow(xl,yl,xr,yr) }
  function mountLimitTable(container, fn, opts) {
    opts = opts || {};
    const c = opts.c;
    const distances = opts.distances || [1, 0.5, 0.25, 0.1, 0.01, 0.001];
    const format = opts.format || defaultLimitFormat;
    const slider = container.querySelector('[data-limit-slider]');
    const leftBody = container.querySelector('[data-limit-left]');
    const rightBody = container.querySelector('[data-limit-right]');
    let shown = 0;

    const addRow = (idx) => {
      const d = distances[idx];
      const xl = c - d, xr = c + d;
      let yl, yr;
      try { yl = fn(xl); } catch (e) { yl = NaN; }
      try { yr = fn(xr); } catch (e) { yr = NaN; }

      const rowL = document.createElement('tr');
      const tdxl = document.createElement('td'); tdxl.textContent = xl.toFixed(4);
      const tdyl = document.createElement('td'); tdyl.textContent = format(yl);
      rowL.appendChild(tdxl); rowL.appendChild(tdyl);
      leftBody.appendChild(rowL);

      const rowR = document.createElement('tr');
      const tdxr = document.createElement('td'); tdxr.textContent = xr.toFixed(4);
      const tdyr = document.createElement('td'); tdyr.textContent = format(yr);
      rowR.appendChild(tdxr); rowR.appendChild(tdyr);
      rightBody.appendChild(rowR);

      if (opts.onRow) opts.onRow(xl, yl, xr, yr);
    };

    slider.min = 0;
    slider.max = distances.length - 1;
    slider.value = 0;
    slider.addEventListener('input', () => {
      const idx = parseInt(slider.value, 10);
      while (shown <= idx) { addRow(shown); shown++; }
    });
    addRow(0); shown = 1;
    return { addRow };
  }

  // One-sided numeric table for behavior as x grows large (limits at infinity) or as x
  // approaches a boundary from one side (infinite limits / vertical asymptotes). Same
  // accumulating-rows idea as mountLimitTable, but driven by an explicit value list
  // instead of a symmetric distance-from-c list, since growth is naturally one-directional.
  // container needs: [data-growth-slider], [data-growth-body]. opts: { values, format, onRow(x,y) }
  function mountGrowthTable(container, fn, opts) {
    opts = opts || {};
    const values = opts.values || [1, 2, 5, 10, 50, 100, 1000];
    const format = opts.format || ((v) => {
      if (v === Infinity) return '∞';
      if (v === -Infinity) return '−∞';
      return Number.isFinite(v) ? String(Math.round(v * 100000) / 100000) : 'undefined';
    });
    const slider = container.querySelector('[data-growth-slider]');
    const body = container.querySelector('[data-growth-body]');
    let shown = 0;

    const addRow = (idx) => {
      const x = values[idx];
      let y;
      try { y = fn(x); } catch (e) { y = NaN; }
      const row = document.createElement('tr');
      const tdx = document.createElement('td'); tdx.textContent = String(x);
      const tdy = document.createElement('td'); tdy.textContent = format(y);
      row.appendChild(tdx); row.appendChild(tdy);
      body.appendChild(row);
      if (opts.onRow) opts.onRow(x, y);
    };

    slider.min = 0;
    slider.max = values.length - 1;
    slider.value = 0;
    slider.addEventListener('input', () => {
      const idx = parseInt(slider.value, 10);
      while (shown <= idx) { addRow(shown); shown++; }
    });
    addRow(0); shown = 1;
    return { addRow };
  }

  function mountSyntheticDivision(container, opts) {
    const coeffs = opts.coeffs;
    const root = opts.root;
    const n = coeffs.length - 1;
    const multCells = Array.from(container.querySelector('[data-synth-mult-row]').children);
    const sumCells = Array.from(container.querySelector('[data-synth-sum-row]').children);
    const nextBtn = container.querySelector('[data-synth-next]');
    const resetBtn = container.querySelector('[data-synth-reset]');
    const readout = container.querySelector('[data-synth-readout]');
    let b, step;

    function fmt(v) {
      return String(Math.round(v * 1000) / 1000);
    }

    function advance() {
      if (step === 0) {
        b = [coeffs[0]];
        sumCells[0].textContent = fmt(coeffs[0]);
        sumCells[0].classList.add('is-active');
        readout.textContent = 'Bring down the leading coefficient: ' + fmt(coeffs[0]) + '.';
      } else {
        const i = step;
        const m = b[i - 1] * root;
        const val = coeffs[i] + m;
        b.push(val);
        multCells[i].textContent = fmt(m);
        sumCells[i - 1].classList.remove('is-active');
        sumCells[i].textContent = fmt(val);
        sumCells[i].classList.add('is-active');
        if (i === n) {
          readout.textContent = 'Multiply ' + fmt(b[i - 1]) + ' × ' + root + ' = ' + fmt(m) + ', add to ' + fmt(coeffs[i]) + ' → remainder = ' + fmt(val) +
            (val === 0 ? '. Zero remainder — x = ' + root + ' is confirmed a root.' : '. Nonzero remainder — x = ' + root + ' is not a root.');
          sumCells[i].classList.add('is-remainder');
        } else {
          readout.textContent = 'Multiply ' + fmt(b[i - 1]) + ' × ' + root + ' = ' + fmt(m) + ', add to ' + fmt(coeffs[i]) + ' → ' + fmt(val) + '.';
        }
      }
      step++;
      if (step > n) nextBtn.disabled = true;
    }

    function reset() {
      step = 0; b = [];
      multCells.forEach(function (c) { c.textContent = ''; });
      sumCells.forEach(function (c) { c.textContent = ''; c.classList.remove('is-active', 'is-remainder'); });
      nextBtn.disabled = false;
      readout.textContent = 'Click "Next Step" to begin.';
    }

    nextBtn.addEventListener('click', advance);
    if (resetBtn) resetBtn.addEventListener('click', reset);
    reset();
    return { reset: reset };
  }

  // Free-drag point a + bi restricted to the upper half-plane, with its conjugate
  // a - bi mirrored automatically across the real axis on every move.
  // opts: { originX, originY, scaleX, scaleY, point, mirrorPoint, dragSurface,
  //         aMin, aMax, bMin, bMax, initialA, initialB, onUpdate(a, b) }
  function mountConjugateMirror(svg, opts) {
    const { originX, originY, scaleX, scaleY, point, mirrorPoint, aMin, aMax, bMin, bMax } = opts;
    const surface = opts.dragSurface || svg;
    const toSvgX = (a) => originX + a * scaleX;
    const toSvgY = (b) => originY - b * scaleY;
    const toMathX = (sx) => (sx - originX) / scaleX;
    const toMathY = (sy) => (originY - sy) / scaleY;

    const update = (a, b) => {
      a = clamp(a, aMin, aMax);
      b = clamp(b, bMin, bMax);
      point.setAttribute('cx', toSvgX(a));
      point.setAttribute('cy', toSvgY(b));
      mirrorPoint.setAttribute('cx', toSvgX(a));
      mirrorPoint.setAttribute('cy', toSvgY(-b));
      if (opts.onUpdate) opts.onUpdate(a, b);
    };

    let dragging = false;
    const start = (e) => { dragging = true; surface.setPointerCapture(e.pointerId); update(toMathX(clientToSvgX(svg, e)), toMathY(clientToSvgY(svg, e))); };
    const move = (e) => { if (dragging) update(toMathX(clientToSvgX(svg, e)), toMathY(clientToSvgY(svg, e))); };
    const end = () => { dragging = false; };

    surface.addEventListener('pointerdown', start);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);

    update(opts.initialA !== undefined ? opts.initialA : 1, opts.initialB !== undefined ? opts.initialB : 1);
    return { setPoint: update };
  }

  // Draggable point constrained to a circle of fixed radius, reporting the angle theta
  // (standard position, counterclockwise-positive, atan2 range (-pi, pi]) rather than an
  // (x, y) pair — the primitive behind any "drag around the unit circle" widget.
  // opts: { centerX, centerY, radius, point, dragSurface, initialAngle, angleMin, angleMax, onUpdate(theta) }
  // angleMin/angleMax optionally restrict the draggable range, e.g. to the first quadrant
  // for a right-triangle picture rather than the full circle.
  function mountPointOnCircle(svg, opts) {
    const { centerX, centerY, radius, point } = opts;
    const surface = opts.dragSurface || svg;
    const toSvgX = (theta) => centerX + radius * Math.cos(theta);
    const toSvgY = (theta) => centerY - radius * Math.sin(theta);
    const clampAngle = (theta) => {
      if (opts.angleMin !== undefined && theta < opts.angleMin) return opts.angleMin;
      if (opts.angleMax !== undefined && theta > opts.angleMax) return opts.angleMax;
      return theta;
    };

    const update = (theta) => {
      theta = clampAngle(theta);
      point.setAttribute('cx', toSvgX(theta));
      point.setAttribute('cy', toSvgY(theta));
      if (opts.onUpdate) opts.onUpdate(theta);
    };

    const angleFromEvent = (e) => {
      const sx = clientToSvgX(svg, e), sy = clientToSvgY(svg, e);
      return Math.atan2(-(sy - centerY), sx - centerX);
    };

    let dragging = false;
    const start = (e) => { dragging = true; surface.setPointerCapture(e.pointerId); update(angleFromEvent(e)); };
    const move = (e) => { if (dragging) update(angleFromEvent(e)); };
    const end = () => { dragging = false; };

    surface.addEventListener('pointerdown', start);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);

    update(opts.initialAngle !== undefined ? opts.initialAngle : 0);
    return { setAngle: update };
  }

  // Renders left/right/midpoint Riemann-sum rectangles under y = fn(x) on [xMin, xMax]
  // split into n subintervals, redrawing into a <g> the lesson provides. Returns the
  // approximated sum so the lesson can report it alongside the rectangles.
  // opts: { fn, xMin, xMax, originX, originY, scaleX, scaleY, rectsGroup, n, method }
  // method is 'left', 'right', or 'mid'.
  function mountRiemannSum(svg, opts) {
    const { fn, xMin, xMax, originX, originY, scaleX, scaleY, rectsGroup } = opts;
    const toSvgX = (mx) => originX + mx * scaleX;
    const toSvgY = (my) => originY - my * scaleY;
    let method = opts.method || 'left';

    const render = (n) => {
      n = Math.max(1, n);
      while (rectsGroup.firstChild) rectsGroup.removeChild(rectsGroup.firstChild);
      const width = (xMax - xMin) / n;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const left = xMin + i * width;
        const right = left + width;
        let sampleX;
        if (method === 'left') sampleX = left;
        else if (method === 'right') sampleX = right;
        else sampleX = (left + right) / 2;
        let h;
        try { h = fn(sampleX); } catch (e) { h = 0; }
        sum += h * width;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const svgLeft = toSvgX(left), svgRight = toSvgX(right);
        const svgBase = toSvgY(0), svgTop = toSvgY(Math.max(h, 0));
        rect.setAttribute('x', Math.min(svgLeft, svgRight));
        rect.setAttribute('y', h >= 0 ? svgTop : svgBase);
        rect.setAttribute('width', Math.abs(svgRight - svgLeft));
        rect.setAttribute('height', Math.abs(svgBase - svgTop));
        rect.setAttribute('class', 'riemann-rect');
        rectsGroup.appendChild(rect);
      }
      if (opts.onUpdate) opts.onUpdate(sum, n, method);
      return sum;
    };

    const setMethod = (m) => { method = m; };

    render(opts.n || 4);
    return { render, setMethod };
  }

  // mountAreaBetweenCurves: like mountRiemannSum, but each rectangle spans the
  // vertical gap between two functions instead of a single function and the
  // x-axis. Rectangles are sampled at each subinterval's midpoint.
  // opts: { fnTop, fnBottom, xMin, xMax, originX, originY, scaleX, scaleY, rectsGroup, n }
  function mountAreaBetweenCurves(svg, opts) {
    const { fnTop, fnBottom, xMin, xMax, originX, originY, scaleX, scaleY, rectsGroup } = opts;
    const toSvgX = (mx) => originX + mx * scaleX;
    const toSvgY = (my) => originY - my * scaleY;

    const render = (n) => {
      n = Math.max(1, n);
      while (rectsGroup.firstChild) rectsGroup.removeChild(rectsGroup.firstChild);
      const width = (xMax - xMin) / n;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const left = xMin + i * width;
        const right = left + width;
        const sampleX = (left + right) / 2;
        let top, bottom;
        try { top = fnTop(sampleX); } catch (e) { top = 0; }
        try { bottom = fnBottom(sampleX); } catch (e) { bottom = 0; }
        const h = top - bottom;
        sum += h * width;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const svgLeft = toSvgX(left), svgRight = toSvgX(right);
        const svgTop = toSvgY(Math.max(top, bottom)), svgBottom = toSvgY(Math.min(top, bottom));
        rect.setAttribute('x', Math.min(svgLeft, svgRight));
        rect.setAttribute('y', svgTop);
        rect.setAttribute('width', Math.abs(svgRight - svgLeft));
        rect.setAttribute('height', Math.abs(svgBottom - svgTop));
        rect.setAttribute('class', 'riemann-rect');
        rectsGroup.appendChild(rect);
      }
      if (opts.onUpdate) opts.onUpdate(sum, n);
      return sum;
    };

    render(opts.n || 8);
    return { render };
  }

  // mountSliceIndicator: tracks a vertical slice line at a slider-controlled x
  // across a 2D base region between fnTop and fnBottom, reporting the slice
  // width s = fnTop(x) - fnBottom(x) back to the caller. Used as the shared
  // base for cross-section, disc, and washer method lessons, each of which
  // turns s into its own cross-sectional area formula.
  // opts: { fnTop, fnBottom, xMin, xMax, originX, originY, scaleX, scaleY, sliceLine, onUpdate }
  function mountSliceIndicator(svg, opts) {
    const { fnTop, xMin, xMax, originX, originY, scaleX, scaleY, sliceLine } = opts;
    const fnBottom = opts.fnBottom || (() => 0);
    const toSvgX = (mx) => originX + mx * scaleX;
    const toSvgY = (my) => originY - my * scaleY;

    const render = (x) => {
      x = Math.max(xMin, Math.min(xMax, x));
      let top, bottom;
      try { top = fnTop(x); } catch (e) { top = 0; }
      try { bottom = fnBottom(x); } catch (e) { bottom = 0; }
      const sx = toSvgX(x);
      sliceLine.setAttribute('x1', sx);
      sliceLine.setAttribute('x2', sx);
      sliceLine.setAttribute('y1', toSvgY(bottom));
      sliceLine.setAttribute('y2', toSvgY(top));
      const s = top - bottom;
      if (opts.onUpdate) opts.onUpdate(x, s);
      return s;
    };

    render(opts.x !== undefined ? opts.x : (xMin + xMax) / 2);
    return { render };
  }

  // mountParametricCurve: draws a curve traced by (xFn(t), yFn(t)) for t in
  // [tMin, tMax] once into curveEl, and returns pointAt(t) for placing a
  // moving marker or tangent line at any parameter value. Reused across
  // parametric, vector-valued, and polar (x = r(θ)cosθ, y = r(θ)sinθ) lessons.
  // opts: { xFn, yFn, tMin, tMax, originX, originY, scaleX, scaleY, curveEl, samples }
  function mountParametricCurve(opts) {
    const { xFn, yFn, tMin, tMax, originX, originY, scaleX, scaleY, curveEl } = opts;
    const n = opts.samples || 100;
    const toSvgX = (mx) => originX + mx * scaleX;
    const toSvgY = (my) => originY - my * scaleY;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = tMin + (tMax - tMin) * (i / n);
      let x, y;
      try { x = xFn(t); y = yFn(t); } catch (e) { continue; }
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      pts.push(toSvgX(x) + ',' + toSvgY(y));
    }
    if (curveEl) curveEl.setAttribute('points', pts.join(' '));

    const pointAt = (t) => ({ x: toSvgX(xFn(t)), y: toSvgY(yFn(t)) });
    return { pointAt, toSvgX, toSvgY };
  }

  return {
    mountFunctionMachine, mountPointOnCurve, mountVerticalLineTest,
    mountTwoPointsOnCurve, mountHorizontalLineTest, mountLiveCurve, mountComposition,
    mountTabs, mountLimitTable, mountGrowthTable, mountSyntheticDivision, mountConjugateMirror,
    mountPointOnCircle, mountRiemannSum, mountAreaBetweenCurves, mountSliceIndicator,
    mountParametricCurve, clamp
  };
})();
