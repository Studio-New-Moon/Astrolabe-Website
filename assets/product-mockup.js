// A product preview: Gelato's own photo of the blank product, with the art
// laid where Gelato places it.
//
// The photos and corner points come from Gelato itself. Each blank is the
// preview of a draft order (never printed or charged) sent with a transparent
// image; each set of corners was measured from a second draft sent with a
// solid 4:3 block, both with fitMethod "meet" exactly as real orders are. So
// the art lands here where it lands on the real thing, including the angle on
// the canvas and the curve of a mug, which a flat rectangle could not show.
//
// Corners are percentages of the photo, clockwise from top left. The art box
// is mapped onto them with a projective transform (CSS matrix3d), and the art
// sits inside that box with object-fit: contain, as "meet" places it.
//
// The mugs and the canvas are not flat: a mug's print curves round the cup and
// narrows towards its edges, and a canvas's turns onto its side. For those the
// art is drawn onto a <canvas>, warped cell by cell along a 10 x 10 grid
// measured from two more drafts printed with coloured stripes (MESHES below;
// astrolabe-art-tools/mockup-mesh/build_meshes.py).
//
// Every position is measured against the photo as it is actually drawn. The
// photo is shown object-fit: contain, so in a box of another shape it has empty
// space beside or above it; placing the art against the box instead of the
// photo stretched it (fixed 2026-11-03).
//
//   ProductMockup.render(container, { photo, quad, art, dark })
//
// Used by /prints/ and the poster print form on /account/.
(function () {
  "use strict";

  var PHOTOS = "/assets/mockups/";

  // product id → corners, and the photo to use for each colour or frame.
  var PRODUCTS = {
    framed: { quad: [[2.67, 3.41], [97.13, 3.41], [97.2, 96.24], [2.6, 96.24]],
              photo: function (o) { return "framed-" + (o.frame || "black"); } },
    canvas: { quad: [[4.4, 7.78], [84.67, 15.55], [84.67, 84.38], [4.4, 92.15]],
              photo: function () { return "canvas"; } },
    metal: { quad: [[0.93, 1.24], [98.87, 1.24], [98.87, 98.5], [0.93, 98.5]],
             photo: function () { return "metal"; } },
    acrylic: { quad: [[0.73, 0.97], [99.07, 0.97], [99.07, 98.67], [0.73, 98.76]],
               photo: function () { return "acrylic"; } },
    tshirt: { quad: [[34.33, 32.73], [65.73, 32.73], [65.8, 56.4], [34.33, 56.4]],
              photo: function (o) { return "tshirt-" + (o.color || "white"); } },
    sweatshirt: { quad: [[35.07, 41.4], [66.2, 41.47], [66.27, 64.87], [35.07, 64.87]],
                  photo: function (o) { return "sweatshirt-" + (o.color || "white"); } },
    tote: { quad: [[24.33, 52.53], [79.04, 52.53], [79.04, 76.93], [24.33, 76.93]],
            photo: function (o) { return "tote-" + (o.color || "natural"); } },
    mug: {
      quad: function (o) {
        // One of the two copies (make_mug_files.py), the one facing the
        // camera; the other is on the far side.
        return o.size === "15-oz"
          ? [[32.0, 25.87], [76.67, 26.07], [75.87, 66.93], [32.53, 66.47]]
          : [[30.73, 31.2], [70.93, 31.67], [70.47, 65.27], [31.2, 64.27]];
      },
      photo: function (o) { return "mug-" + (o.size || "11-oz"); }
    }
  };

  // Per curved product, the centre of each of the art's 10 x 10 cells on the
  // photo, as [x%, y%], rows top to bottom. Mugs show the copy facing the camera.
  var MESHES = {"canvas":[[[7.31,8.7],[15.61,9.35],[26.11,10.47],[36.04,11.53],[45.45,12.54],[54.35,13.49],[62.85,14.39],[70.92,15.26],[78.58,16.07],[83.53,16.6]],[[7.31,15.16],[15.61,15.72],[26.11,16.66],[36.05,17.56],[45.45,18.4],[54.35,19.2],[62.85,19.97],[70.92,20.69],[78.59,21.38],[83.53,21.83]],[[7.3,25.08],[15.61,25.48],[26.11,26.15],[36.05,26.79],[45.45,27.4],[54.35,27.97],[62.85,28.52],[70.92,29.04],[78.58,29.53],[83.53,29.85]],[[7.3,35.0],[15.61,35.24],[26.11,35.65],[36.05,36.03],[45.45,36.39],[54.35,36.74],[62.85,37.06],[70.92,37.38],[78.58,37.67],[83.53,37.87]],[[7.3,44.91],[15.61,44.99],[26.11,45.13],[36.04,45.26],[45.45,45.38],[54.35,45.49],[62.85,45.6],[70.92,45.7],[78.59,45.81],[83.53,45.87]],[[7.31,54.83],[15.61,54.76],[26.11,54.62],[36.05,54.5],[45.45,54.37],[54.35,54.26],[62.85,54.15],[70.92,54.05],[78.59,53.95],[83.53,53.89]],[[7.3,64.77],[15.61,64.54],[26.11,64.14],[36.04,63.75],[45.45,63.39],[54.35,63.05],[62.85,62.72],[70.92,62.41],[78.58,62.12],[83.53,61.93]],[[7.31,74.7],[15.61,74.31],[26.11,73.64],[36.04,73.0],[45.45,72.39],[54.35,71.82],[62.85,71.28],[70.92,70.76],[78.59,70.27],[83.53,69.95]],[[7.3,84.62],[15.61,84.07],[26.11,83.13],[36.05,82.23],[45.45,81.39],[54.35,80.59],[62.85,79.82],[70.92,79.1],[78.59,78.41],[83.53,77.97]],[[7.31,91.15],[15.61,90.5],[26.11,89.38],[36.05,88.32],[45.45,87.31],[54.35,86.36],[62.85,85.46],[70.92,84.6],[78.58,83.78],[83.53,83.25]]],"mug-11-oz":[[[31.58,33.13],[33.98,33.53],[37.37,33.94],[41.46,34.27],[46.12,34.47],[51.1,34.56],[56.16,34.53],[61.06,34.36],[65.51,34.06],[69.28,33.68]],[[31.63,36.5],[34.01,36.98],[37.41,37.42],[41.5,37.78],[46.13,38.01],[51.1,38.12],[56.17,38.07],[61.06,37.88],[65.49,37.56],[69.24,37.11]],[[31.68,39.83],[34.07,40.35],[37.44,40.84],[41.5,41.22],[46.14,41.48],[51.09,41.59],[56.14,41.54],[61.01,41.34],[65.43,40.98],[69.18,40.49]],[[31.72,43.16],[34.09,43.7],[37.47,44.23],[41.53,44.64],[46.14,44.93],[51.1,45.03],[56.13,44.99],[60.99,44.77],[65.4,44.39],[69.13,43.87]],[[31.77,46.5],[34.14,47.1],[37.5,47.67],[41.56,48.12],[46.16,48.41],[51.1,48.53],[56.13,48.49],[60.96,48.25],[65.35,47.83],[69.09,47.28]],[[31.83,49.83],[34.19,50.48],[37.53,51.08],[41.58,51.56],[46.17,51.88],[51.1,52.02],[56.1,51.96],[60.92,51.7],[65.32,51.27],[69.03,50.66]],[[31.87,53.14],[34.22,53.81],[37.57,54.47],[41.6,54.99],[46.17,55.33],[51.07,55.49],[56.07,55.41],[60.9,55.14],[65.27,54.66],[68.98,54.03]],[[31.9,56.45],[34.27,57.19],[37.6,57.87],[41.6,58.42],[46.17,58.79],[51.07,58.95],[56.07,58.87],[60.88,58.57],[65.23,58.08],[68.93,57.4]],[[31.97,59.77],[34.3,60.52],[37.64,61.25],[41.66,61.84],[46.22,62.21],[51.09,62.38],[56.03,62.31],[60.83,62.0],[65.2,61.47],[68.89,60.74]],[[32.01,63.04],[34.35,63.83],[37.67,64.6],[41.67,65.21],[46.23,65.62],[51.1,65.79],[56.03,65.72],[60.81,65.39],[65.15,64.84],[68.83,64.08]]],"mug-15-oz":[[[33.07,28.17],[35.97,28.57],[40.09,28.94],[45.0,29.23],[50.47,29.4],[56.2,29.43],[61.83,29.35],[67.03,29.13],[71.53,28.8],[75.12,28.39]],[[33.12,32.36],[36.01,32.83],[40.11,33.27],[45.01,33.59],[50.47,33.79],[56.17,33.83],[61.78,33.72],[66.97,33.48],[71.46,33.11],[75.04,32.62]],[[33.18,36.52],[36.07,37.07],[40.17,37.56],[45.06,37.93],[50.49,38.14],[56.16,38.2],[61.76,38.07],[66.92,37.8],[71.39,37.37],[74.95,36.83]],[[33.24,40.65],[36.11,41.25],[40.18,41.79],[45.07,42.21],[50.5,42.45],[56.14,42.51],[61.7,42.38],[66.86,42.06],[71.32,41.58],[74.87,40.98]],[[33.29,44.79],[36.15,45.41],[40.22,46.04],[45.09,46.48],[50.5,46.75],[56.14,46.81],[61.67,46.66],[66.8,46.33],[71.25,45.8],[74.8,45.14]],[[33.34,48.87],[36.19,49.57],[40.25,50.23],[45.1,50.73],[50.5,51.03],[56.1,51.09],[61.63,50.93],[66.75,50.56],[71.18,49.98],[74.72,49.27]],[[33.39,52.91],[36.24,53.69],[40.27,54.41],[45.1,54.94],[50.47,55.26],[56.07,55.34],[61.6,55.16],[66.7,54.75],[71.11,54.13],[74.64,53.36]],[[33.45,56.96],[36.29,57.79],[40.32,58.56],[45.13,59.13],[50.47,59.47],[56.06,59.55],[61.56,59.37],[66.64,58.93],[71.04,58.26],[74.56,57.43]],[[33.49,60.96],[36.32,61.83],[40.34,62.66],[45.14,63.28],[50.47,63.63],[56.03,63.73],[61.51,63.52],[66.58,63.06],[70.98,62.35],[74.48,61.45]],[[33.54,64.93],[36.37,65.87],[40.37,66.75],[45.14,67.4],[50.47,67.79],[56.04,67.88],[61.49,67.66],[66.53,67.17],[70.91,66.42],[74.41,65.46]]]};
  function meshFor(id, o) {
    if (id === "mug") return MESHES[o.size === "15-oz" ? "mug-15-oz" : "mug-11-oz"];
    return MESHES[id] || null;
  }

  // Colours the art is printed onto rather than into: on these, darkening by
  // multiply would bury it, so it is drawn plainly.
  var DARK = { black: true };

  // The 3×3 projective map taking the unit square to a quadrilateral
  // (Heckbert, "Fundamentals of Texture Mapping", 1989).
  function squareToQuad(p) {
    var x0 = p[0][0], y0 = p[0][1], x1 = p[1][0], y1 = p[1][1];
    var x2 = p[2][0], y2 = p[2][1], x3 = p[3][0], y3 = p[3][1];
    var sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    var a, b, c = x0, d, e, f = y0, g, h;
    if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
      a = x1 - x0; b = x3 - x0; d = y1 - y0; e = y3 - y0; g = 0; h = 0;
    } else {
      var dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
      var den = dx1 * dy2 - dx2 * dy1;
      g = (sx * dy2 - dx2 * sy) / den;
      h = (dx1 * sy - sx * dy1) / den;
      a = x1 - x0 + g * x1; b = x3 - x0 + h * x3;
      d = y1 - y0 + g * y1; e = y3 - y0 + h * y3;
    }
    return [a, b, c, d, e, f, g, h];
  }

  var ART_W = 400, ART_H = 300;   // the art box before it is mapped, 4:3

  // Where the photo itself is drawn inside the container, in px: object-fit:
  // contain leaves empty space beside it in a box of another shape.
  function photoRect(container) {
    var photo = container.querySelector(".mock-photo");
    var nw = photo.naturalWidth, nh = photo.naturalHeight;
    var bw = photo.clientWidth, bh = photo.clientHeight;
    if (!nw || !nh || !bw || !bh) return null;
    var s = Math.min(bw / nw, bh / nh);
    var w = nw * s, h = nh * s;
    return { x: photo.offsetLeft + (bw - w) / 2, y: photo.offsetTop + (bh - h) / 2, w: w, h: h };
  }

  function place(container) {
    var rect = photoRect(container);
    if (!rect) return;
    if (container._mesh) { box = container.querySelector(".mock-art"); box.style.display = "none"; return drawMesh(container, rect); }
    container.querySelector("canvas.mock-warp").style.display = "none";
    var box = container.querySelector(".mock-art");
    box.style.display = "";
    var quad = container._quad;
    if (!box || !quad) return;
    var px = quad.map(function (q) { return [rect.x + q[0] / 100 * rect.w, rect.y + q[1] / 100 * rect.h]; });
    var m = squareToQuad(px);
    box.style.transform = "matrix3d(" + [
      m[0] / ART_W, m[3] / ART_W, 0, m[6] / ART_W,
      m[1] / ART_H, m[4] / ART_H, 0, m[7] / ART_H,
      0, 0, 1, 0,
      m[2], m[5], 0, 1
    ].join(",") + ")";
  }

  // Mesh nodes in px: the 10 x 10 cell centres, plus a ring half a cell
  // outside them so the warp reaches the art's own edges.
  function meshNodes(centres, rect) {
    var n = centres.length, g = [];
    function at(j, i) { var c = centres[j][i]; return [rect.x + c[0] / 100 * rect.w, rect.y + c[1] / 100 * rect.h]; }
    function ext(a, b) { return [a[0] + (a[0] - b[0]) / 2, a[1] + (a[1] - b[1]) / 2]; }
    for (var j = -1; j <= n; j++) {
      var row = [];
      for (var i = -1; i <= n; i++) {
        var jj = Math.min(Math.max(j, 0), n - 1), ii = Math.min(Math.max(i, 0), n - 1);
        var p = at(jj, ii);
        if (i < 0) p = ext(p, at(jj, 1)); else if (i >= n) p = ext(p, at(jj, n - 2));
        if (j < 0) { var q = at(1, ii); if (i < 0) q = ext(q, at(1, 1)); else if (i >= n) q = ext(q, at(1, n - 2)); p = ext(p, q); }
        else if (j >= n) { var q2 = at(n - 2, ii); if (i < 0) q2 = ext(q2, at(n - 2, 1)); else if (i >= n) q2 = ext(q2, at(n - 2, n - 2)); p = ext(p, q2); }
        row.push(p);
      }
      g.push(row);
    }
    return g;   // (n + 2) x (n + 2)
  }

  // Draws the source triangle s (in art px) onto destination triangle d.
  function triangle(ctx, img, s, d) {
    var x0 = s[0][0], y0 = s[0][1], x1 = s[1][0], y1 = s[1][1], x2 = s[2][0], y2 = s[2][1];
    var u0 = d[0][0], v0 = d[0][1], u1 = d[1][0], v1 = d[1][1], u2 = d[2][0], v2 = d[2][1];
    // grow the destination by half a pixel round its centroid, so cells meet without hairlines
    var cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3;
    function grow(u, v) { var dx = u - cx, dy = v - cy, l = Math.hypot(dx, dy) || 1; return [u + dx / l * 0.6, v + dy / l * 0.6]; }
    var g0 = grow(u0, v0), g1 = grow(u1, v1), g2 = grow(u2, v2);
    ctx.save();
    ctx.setTransform(ctx._dpr, 0, 0, ctx._dpr, 0, 0);   // the clip is in CSS px, like the mesh
    ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(g1[0], g1[1]); ctx.lineTo(g2[0], g2[1]); ctx.closePath(); ctx.clip();
    var den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
    if (Math.abs(den) < 1e-9) { ctx.restore(); return; }
    var a = (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / den;
    var b = (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / den;
    var c = (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / den;
    var dd = (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / den;
    var e = (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / den;
    var f = (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / den;
    ctx.setTransform(ctx._dpr * a, ctx._dpr * b, ctx._dpr * c, ctx._dpr * dd, ctx._dpr * e, ctx._dpr * f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function drawMesh(container, rect) {
    var canvas = container.querySelector("canvas.mock-warp");
    var img = container.querySelector(".mock-art img");
    if (!img.complete || !img.naturalWidth) return;
    var W = container.clientWidth, H = container.clientHeight, dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px"; canvas.style.display = "";
    var ctx = canvas.getContext("2d");
    ctx._dpr = dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    // The art inside the 4:3 box as "meet" places it: contained, centred.
    var iw = img.naturalWidth, ih = img.naturalHeight, BW = 4, BH = 3;
    var sc = Math.min(BW / iw, BH / ih), ox = (BW - iw * sc) / 2, oy = (BH - ih * sc) / 2;
    function src(u, v) { return [(u * BW - ox) / sc, (v * BH - oy) / sc]; }   // art px for a point of the 4:3 box
    var nodes = meshNodes(container._mesh, rect);
    var n = container._mesh.length;
    function uv(k) { return k === 0 ? 0 : k === n + 1 ? 1 : (k - 0.5) / n; }
    for (var j = 0; j <= n; j++) {
      for (var i = 0; i <= n; i++) {
        var s00 = src(uv(i), uv(j)), s10 = src(uv(i + 1), uv(j)), s01 = src(uv(i), uv(j + 1)), s11 = src(uv(i + 1), uv(j + 1));
        var d00 = nodes[j][i], d10 = nodes[j][i + 1], d01 = nodes[j + 1][i], d11 = nodes[j + 1][i + 1];
        triangle(ctx, img, [s00, s10, s11], [d00, d10, d11]);
        triangle(ctx, img, [s00, s11, s01], [d00, d11, d01]);
      }
    }
  }

  function ensure(container) {
    if (container._built) return;
    container.classList.add("mockup");
    container.innerHTML =
      '<img class="mock-photo" alt="" decoding="async">' +
      '<div class="mock-art"><img alt="" decoding="async"></div>' +
      '<canvas class="mock-warp" aria-hidden="true"></canvas>';
    var style = container.querySelector(".mock-art").style;
    style.width = ART_W + "px";
    style.height = ART_H + "px";
    container.querySelector(".mock-photo").addEventListener("load", function () { place(container); });
    container.querySelector(".mock-art img").addEventListener("load", function () { place(container); });
    if (window.ResizeObserver) new ResizeObserver(function () { place(container); }).observe(container);
    container._built = true;
  }

  /**
   * Show `art` (a URL) on product `id` with options `o`, e.g.
   * render(el, "tshirt", { color: "black", size: "m" }, "/assets/prints/leo.jpg").
   * Returns false for a product it has no photo for.
   */
  function render(container, id, o, art, label) {
    var product = PRODUCTS[id];
    if (!product) return false;
    o = o || {};
    ensure(container);
    container._quad = typeof product.quad === "function" ? product.quad(o) : product.quad;
    container._mesh = meshFor(id, o);
    container.classList.toggle("on-dark", !!DARK[o.color]);
    var photo = container.querySelector(".mock-photo");
    var src = PHOTOS + product.photo(o) + ".webp";
    if (photo.getAttribute("src") !== src) photo.setAttribute("src", src);
    var artImg = container.querySelector(".mock-art img");
    if (artImg.getAttribute("src") !== art) artImg.setAttribute("src", art);
    container.setAttribute("role", "img");
    container.setAttribute("aria-label", label || "");
    place(container);
    return true;
  }

  window.ProductMockup = { render: render, has: function (id) { return !!PRODUCTS[id]; } };
})();
