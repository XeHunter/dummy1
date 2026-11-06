// Single-series area chart (portfolio value over time) in plain SVG.
// Crosshair + tooltip on hover, arrow keys when focused, redraws on resize.

import { el } from "./utils.js";

const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

const compactUsd = (v) =>
  v.toLocaleString(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const fullUsd = (v) => v.toLocaleString(undefined, { style: "currency", currency: "USD" });
const fmtDate = (t, opts = { month: "short", day: "numeric" }) => new Date(t).toLocaleDateString(undefined, opts);

let gradId = 0;

export function areaChart(points, { height = 220, label = "Portfolio value" } = {}) {
  const tooltip = el("div", { class: "chart-tip", hidden: true });
  const wrap = el("div", { class: "chart", tabindex: "0", role: "img", "aria-label": `${label}, ${points.length} days, from ${fullUsd(points[0].v)} to ${fullUsd(points.at(-1).v)}` }, tooltip);
  const id = `area-grad-${++gradId}`;

  let svg = null;
  let geom = null;
  let active = null;

  function draw(width) {
    if (width < 50) return;
    const pad = { t: 12, r: 12, b: 26, l: 58 };
    const W = width, H = height;
    const ys = points.map((p) => p.v);
    const min = Math.min(...ys), max = Math.max(...ys);
    const span = max - min || max * 0.1 || 1;
    const y0 = Math.max(0, min - span * 0.15), y1 = max + span * 0.1;
    const x = (i) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
    geom = { x, y, pad, W, H };

    svg?.remove();
    svg = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: "chart-svg" });

    const defs = svgEl("defs");
    const grad = svgEl("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(svgEl("stop", { offset: "0%", "stop-color": "var(--series-1)", "stop-opacity": 0.22 }));
    grad.append(svgEl("stop", { offset: "100%", "stop-color": "var(--series-1)", "stop-opacity": 0 }));
    defs.append(grad);
    svg.append(defs);

    // Recessive grid + y labels
    for (let k = 0; k <= 3; k++) {
      const v = y0 + ((y1 - y0) * k) / 3;
      const gy = y(v);
      svg.append(svgEl("line", { x1: pad.l, x2: W - pad.r, y1: gy, y2: gy, class: "grid" }));
      const t = svgEl("text", { x: pad.l - 8, y: gy + 4, "text-anchor": "end", class: "axis" });
      t.textContent = compactUsd(v);
      svg.append(t);
    }

    // X labels: first, middle, last
    [0, Math.floor((points.length - 1) / 2), points.length - 1].forEach((i, n) => {
      const t = svgEl("text", { x: x(i), y: H - 6, "text-anchor": ["start", "middle", "end"][n], class: "axis" });
      t.textContent = fmtDate(points[i].t);
      svg.append(t);
    });

    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    const baseY = H - pad.b;
    svg.append(svgEl("path", { d: `${line}L${x(points.length - 1)},${baseY}L${x(0)},${baseY}Z`, fill: `url(#${id})` }));
    svg.append(svgEl("path", { d: line, class: "line" }));

    // Endpoint marker (ringed so it separates from the line)
    const last = points.length - 1;
    svg.append(svgEl("circle", { cx: x(last), cy: y(points[last].v), r: 4, class: "dot" }));

    // Hover layer
    const cross = svgEl("line", { y1: pad.t, y2: baseY, class: "crosshair", visibility: "hidden" });
    const hoverDot = svgEl("circle", { r: 5, class: "dot", visibility: "hidden" });
    svg.append(cross, hoverDot);
    geom.cross = cross;
    geom.hoverDot = hoverDot;

    wrap.prepend(svg);
    if (active != null) show(active);
  }

  function show(i) {
    active = i;
    const { x, y, cross, hoverDot, W } = geom;
    const px = x(i), py = y(points[i].v);
    cross.setAttribute("x1", px);
    cross.setAttribute("x2", px);
    cross.setAttribute("visibility", "visible");
    hoverDot.setAttribute("cx", px);
    hoverDot.setAttribute("cy", py);
    hoverDot.setAttribute("visibility", "visible");

    const prev = points[i - 1]?.v;
    const delta = prev ? ((points[i].v - prev) / prev) * 100 : null;
    tooltip.replaceChildren(
      el("div", { class: "strong" }, fullUsd(points[i].v)),
      el("div", { class: "muted small" }, fmtDate(points[i].t, { weekday: "short", month: "short", day: "numeric" })),
      delta != null ? el("div", { class: `small ${delta >= 0 ? "up" : "down"}` }, `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(2)}% day`) : null,
    );
    tooltip.hidden = false;
    const tipW = tooltip.offsetWidth;
    tooltip.style.left = `${Math.min(Math.max(px - tipW / 2, 0), W - tipW)}px`;
    tooltip.style.top = `${Math.max(py - tooltip.offsetHeight - 14, 0)}px`;
  }

  function hide() {
    active = null;
    tooltip.hidden = true;
    geom?.cross.setAttribute("visibility", "hidden");
    geom?.hoverDot.setAttribute("visibility", "hidden");
  }

  wrap.addEventListener("pointermove", (e) => {
    if (!geom) return;
    const px = e.clientX - wrap.getBoundingClientRect().left;
    const frac = (px - geom.pad.l) / (geom.W - geom.pad.l - geom.pad.r);
    show(Math.min(points.length - 1, Math.max(0, Math.round(frac * (points.length - 1)))));
  });
  wrap.addEventListener("pointerleave", hide);
  wrap.addEventListener("blur", hide);
  wrap.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const start = active ?? points.length - 1;
    show(Math.min(points.length - 1, Math.max(0, start + (e.key === "ArrowRight" ? 1 : -1))));
  });

  // Redraw on the next frame, and only when the width actually changed —
  // drawing synchronously inside the observer causes a ResizeObserver loop.
  let lastWidth = 0;
  let frame = 0;
  new ResizeObserver((entries) => {
    const width = Math.floor(entries[0].contentRect.width);
    if (width === lastWidth) return;
    lastWidth = width;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => draw(width));
  }).observe(wrap);
  return wrap;
}
