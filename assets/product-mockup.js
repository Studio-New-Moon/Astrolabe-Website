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

  function place(container) {
    var box = container.querySelector(".mock-art");
    var quad = container._quad;
    if (!box || !quad) return;
    var W = container.clientWidth, H = container.clientHeight;
    if (!W || !H) return;
    var px = quad.map(function (q) { return [q[0] / 100 * W, q[1] / 100 * H]; });
    var m = squareToQuad(px);
    box.style.transform = "matrix3d(" + [
      m[0] / ART_W, m[3] / ART_W, 0, m[6] / ART_W,
      m[1] / ART_H, m[4] / ART_H, 0, m[7] / ART_H,
      0, 0, 1, 0,
      m[2], m[5], 0, 1
    ].join(",") + ")";
  }

  function ensure(container) {
    if (container._built) return;
    container.classList.add("mockup");
    container.innerHTML =
      '<img class="mock-photo" alt="" decoding="async">' +
      '<div class="mock-art"><img alt="" decoding="async"></div>';
    var style = container.querySelector(".mock-art").style;
    style.width = ART_W + "px";
    style.height = ART_H + "px";
    container.querySelector(".mock-photo").addEventListener("load", function () { place(container); });
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
