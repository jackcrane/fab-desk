import React, { useLayoutEffect, useMemo, useRef } from "react";

export const DitherMeshGradient = ({
  colorA = "#f1f3f4",
  colorB = "#fff",
  speed = 1,
  pixelSize = 3,
  quality = 1,
  className = "",
  style = {},
}) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    dpr: 1,
    w: 0,
    h: 0,
    iw: 0,
    ih: 0,
    imageData: null,
    buf: null,
    ctx: null,
    t0: 0,
  });

  const bayer8 = useMemo(() => {
    const m = [
      [0, 48, 12, 60, 3, 51, 15, 63],
      [32, 16, 44, 28, 35, 19, 47, 31],
      [8, 56, 4, 52, 11, 59, 7, 55],
      [40, 24, 36, 20, 43, 27, 39, 23],
      [2, 50, 14, 62, 1, 49, 13, 61],
      [34, 18, 46, 30, 33, 17, 45, 29],
      [10, 58, 6, 54, 9, 57, 5, 53],
      [42, 26, 38, 22, 41, 25, 37, 21],
    ];
    const out = new Float32Array(64);
    let i = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        out[i++] = (m[y][x] + 0.5) / 64;
      }
    }
    return out;
  }, []);

  const parseHex = (hex) => {
    const s = String(hex).trim().replace("#", "");
    const h =
      s.length === 3
        ? s
            .split("")
            .map((c) => c + c)
            .join("")
        : s.padEnd(6, "0").slice(0, 6);
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };

  const smoothstep = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  const hash2 = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };

  const valueNoise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;

    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);

    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const ab = a + (b - a) * u;
    const cd = c + (d - c) * u;
    return ab + (cd - ab) * v;
  };

  const fbm = (x, y) => {
    let f = 0;
    let amp = 0.55;
    let freq = 1.0;
    for (let i = 0; i < 4; i++) {
      f += amp * valueNoise(x * freq, y * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return f;
  };

  const mix = (a, b, t) => a + (b - a) * t;

  const tick = (now, scheduleNext = true) => {
    const st = stateRef.current;
    const { ctx, iw, ih, imageData, buf, t0 } = st;
    if (!ctx || !imageData || !buf || iw <= 0 || ih <= 0) return;

    const t = (now - t0) * 0.001 * speed;

    const ca = parseHex(colorA);
    const cb = parseHex(colorB);

    const nx = 1 / Math.max(1, iw);
    const ny = 1 / Math.max(1, ih);

    let p = 0;
    for (let y = 0; y < ih; y++) {
      const v = y * ny;
      for (let x = 0; x < iw; x++) {
        const u = x * nx;

        const warp1 = fbm(u * 3.2 + 0.15 * t, v * 3.2 - 0.12 * t);
        const warp2 = fbm(u * 5.1 - 0.11 * t, v * 5.1 + 0.14 * t);

        const su = u + (warp1 - 0.5) * 0.18 + (warp2 - 0.5) * 0.08;
        const sv = v + (warp2 - 0.5) * 0.18 - (warp1 - 0.5) * 0.08;

        const g1 =
          Math.sin((su * 2.6 + sv * 1.4) * Math.PI + t * 0.8) * 0.5 + 0.5;
        const g2 =
          Math.cos((su * 1.1 - sv * 2.2) * Math.PI - t * 0.6) * 0.5 + 0.5;

        const mesh = fbm(su * 9.0 + t * 0.12, sv * 9.0 - t * 0.1);
        const field = 0.55 * g1 + 0.35 * g2 + 0.35 * mesh;

        const vign =
          1 -
          0.55 *
            smoothstep(
              0.25,
              0.95,
              Math.sqrt((u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5)) / 0.7071,
            );

        const lum = Math.max(0, Math.min(1, field * vign));

        const threshold = bayer8[((x & 7) << 3) | (y & 7)];
        const pickB = lum > threshold;

        buf[p++] = pickB ? cb.r : ca.r;
        buf[p++] = pickB ? cb.g : ca.g;
        buf[p++] = pickB ? cb.b : ca.b;
        buf[p++] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    if (scheduleNext) {
      rafRef.current = requestAnimationFrame((n) => tick(n, true));
    }
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;

    const st = stateRef.current;
    st.ctx = ctx;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();

      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      // round UP so we never underfill
      const cellsX = Math.max(1, Math.ceil(w / pixelSize));
      const cellsY = Math.max(1, Math.ceil(h / pixelSize));

      const iw = Math.floor(cellsX * quality);
      const ih = Math.floor(cellsY * quality);

      canvas.width = iw;
      canvas.height = ih;

      // always fill container
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      ctx.imageSmoothingEnabled = false;

      st.w = w;
      st.h = h;
      st.iw = iw;
      st.ih = ih;

      const imageData = ctx.createImageData(iw, ih);
      st.imageData = imageData;
      st.buf = imageData.data;

      // Paint fallback immediately so the canvas never shows default black.
      ctx.fillStyle = colorA;
      ctx.fillRect(0, 0, iw, ih);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    resize();
    st.t0 = performance.now();
    cancelAnimationFrame(rafRef.current);
    tick(st.t0, false);
    rafRef.current = requestAnimationFrame((n) => tick(n, true));

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorA, colorB, speed, pixelSize, quality]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: colorA,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          backgroundColor: colorA,
          imageRendering: "pixelated",
          transform: "translateZ(0)",
        }}
      />
    </div>
  );
};

export default DitherMeshGradient;

export const DitherMeshGradientFill = (props) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <DitherMeshGradient {...props} />
    </div>
  );
};
