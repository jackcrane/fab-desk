import { memo, useLayoutEffect, useMemo, useRef } from "react";

const HASH_PRIME_X = 374761393;
const HASH_PRIME_Y = 668265263;
const HASH_MIX = 1274126177;
const INV_UINT32 = 1 / 4294967296;
const BAYER8 = new Float32Array([
  (0 + 0.5) / 64,
  (48 + 0.5) / 64,
  (12 + 0.5) / 64,
  (60 + 0.5) / 64,
  (3 + 0.5) / 64,
  (51 + 0.5) / 64,
  (15 + 0.5) / 64,
  (63 + 0.5) / 64,
  (32 + 0.5) / 64,
  (16 + 0.5) / 64,
  (44 + 0.5) / 64,
  (28 + 0.5) / 64,
  (35 + 0.5) / 64,
  (19 + 0.5) / 64,
  (47 + 0.5) / 64,
  (31 + 0.5) / 64,
  (8 + 0.5) / 64,
  (56 + 0.5) / 64,
  (4 + 0.5) / 64,
  (52 + 0.5) / 64,
  (11 + 0.5) / 64,
  (59 + 0.5) / 64,
  (7 + 0.5) / 64,
  (55 + 0.5) / 64,
  (40 + 0.5) / 64,
  (24 + 0.5) / 64,
  (36 + 0.5) / 64,
  (20 + 0.5) / 64,
  (43 + 0.5) / 64,
  (27 + 0.5) / 64,
  (39 + 0.5) / 64,
  (23 + 0.5) / 64,
  (2 + 0.5) / 64,
  (50 + 0.5) / 64,
  (14 + 0.5) / 64,
  (62 + 0.5) / 64,
  (1 + 0.5) / 64,
  (49 + 0.5) / 64,
  (13 + 0.5) / 64,
  (61 + 0.5) / 64,
  (34 + 0.5) / 64,
  (18 + 0.5) / 64,
  (46 + 0.5) / 64,
  (30 + 0.5) / 64,
  (33 + 0.5) / 64,
  (17 + 0.5) / 64,
  (45 + 0.5) / 64,
  (29 + 0.5) / 64,
  (10 + 0.5) / 64,
  (58 + 0.5) / 64,
  (6 + 0.5) / 64,
  (54 + 0.5) / 64,
  (9 + 0.5) / 64,
  (57 + 0.5) / 64,
  (5 + 0.5) / 64,
  (53 + 0.5) / 64,
  (42 + 0.5) / 64,
  (26 + 0.5) / 64,
  (38 + 0.5) / 64,
  (22 + 0.5) / 64,
  (41 + 0.5) / 64,
  (25 + 0.5) / 64,
  (37 + 0.5) / 64,
  (21 + 0.5) / 64,
]);

const VIGNETTE_EDGE_START = 0.25;
const VIGNETTE_EDGE_END = 0.95;
const VIGNETTE_STRENGTH = 0.55;
const INV_VIGNETTE_RADIUS = 1 / 0.7071;
const FRAME_INTERVAL_MS = 1000 / 30;
const INPUT_FOCUSED_FRAME_INTERVAL_MS = 1000 / 12;

function parseHexColor(hex) {
  const source = String(hex).trim();
  const stripped = source.startsWith("#") ? source.slice(1) : source;
  const normalized =
    stripped.length === 3
      ? `${stripped[0]}${stripped[0]}${stripped[1]}${stripped[1]}${stripped[2]}${stripped[2]}`
      : stripped.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function smoothstep(edge0, edge1, x) {
  let t = (x - edge0) / (edge1 - edge0);
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}

function hash2(x, y) {
  let h = Math.imul(x | 0, HASH_PRIME_X) ^ Math.imul(y | 0, HASH_PRIME_Y);
  h = Math.imul(h ^ (h >>> 13), HASH_MIX);
  return ((h ^ (h >>> 16)) >>> 0) * INV_UINT32;
}

function valueNoise(x, y) {
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
}

function fbm(x, y) {
  let f = 0;
  let amp = 0.55;
  let freq = 1;

  for (let octave = 0; octave < 4; octave += 1) {
    f += amp * valueNoise(x * freq, y * freq);
    freq *= 2;
    amp *= 0.5;
  }

  return f;
}

export const DitherMeshGradient = memo(function DitherMeshGradient({
  colorA = "#f1f3f4",
  colorB = "#fff",
  speed = 1,
  pixelSize = 3,
  quality = 1,
  className = "",
  style = {},
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    w: 0,
    h: 0,
    iw: 0,
    ih: 0,
    imageData: null,
    buf: null,
    ctx: null,
    t0: 0,
    uAxis: null,
    vAxis: null,
    vignette: null,
    threshold: null,
    lastFrameAt: 0,
    hasFocusedInput: false,
  });

  const parsedColors = useMemo(
    () => ({
      color1: parseHexColor(colorA),
      color2: parseHexColor(colorB),
    }),
    [colorA, colorB],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) {
      return undefined;
    }

    const st = stateRef.current;
    st.ctx = ctx;
    st.lastFrameAt = 0;
    st.hasFocusedInput = false;

    const updateFocusedInputState = () => {
      const active = document.activeElement;
      st.hasFocusedInput = Boolean(
        active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT" ||
            active.getAttribute("contenteditable") === "true"),
      );
    };

    const onFocusIn = () => {
      updateFocusedInputState();
    };

    const onFocusOut = () => {
      updateFocusedInputState();
    };

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    updateFocusedInputState();

    const buildStaticBuffers = () => {
      const iw = st.iw;
      const ih = st.ih;

      st.uAxis = new Float32Array(iw);
      st.vAxis = new Float32Array(ih);

      for (let x = 0; x < iw; x += 1) {
        st.uAxis[x] = x / Math.max(1, iw);
      }

      for (let y = 0; y < ih; y += 1) {
        st.vAxis[y] = y / Math.max(1, ih);
      }

      const size = iw * ih;
      st.vignette = new Float32Array(size);
      st.threshold = new Float32Array(size);

      let i = 0;
      for (let y = 0; y < ih; y += 1) {
        const v = st.vAxis[y];
        const dy = v - 0.5;
        for (let x = 0; x < iw; x += 1) {
          const u = st.uAxis[x];
          const dx = u - 0.5;
          const radius = Math.sqrt(dx * dx + dy * dy) * INV_VIGNETTE_RADIUS;
          const vig = 1 - VIGNETTE_STRENGTH * smoothstep(VIGNETTE_EDGE_START, VIGNETTE_EDGE_END, radius);

          st.vignette[i] = vig;
          st.threshold[i] = BAYER8[((x & 7) << 3) | (y & 7)];
          i += 1;
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      const cellsX = Math.max(1, Math.ceil(w / pixelSize));
      const cellsY = Math.max(1, Math.ceil(h / pixelSize));
      const iw = Math.floor(cellsX * quality);
      const ih = Math.floor(cellsY * quality);

      const sizeChanged = st.iw !== iw || st.ih !== ih;

      canvas.width = iw;
      canvas.height = ih;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.imageSmoothingEnabled = false;

      st.w = w;
      st.h = h;
      st.iw = iw;
      st.ih = ih;

      if (sizeChanged || !st.imageData || !st.buf) {
        st.imageData = ctx.createImageData(iw, ih);
        st.buf = st.imageData.data;
        buildStaticBuffers();
      }

      ctx.fillStyle = colorA;
      ctx.fillRect(0, 0, iw, ih);
    };

    const tick = (now, scheduleNext = true) => {
      const { ctx: drawCtx, iw, ih, imageData, buf, t0, uAxis, vAxis, vignette, threshold } = st;
      if (!drawCtx || !imageData || !buf || !uAxis || !vAxis || !vignette || !threshold || iw <= 0 || ih <= 0) {
        if (scheduleNext) {
          rafRef.current = requestAnimationFrame((nextNow) => tick(nextNow, true));
        }
        return;
      }

      if (document.visibilityState !== "visible") {
        if (scheduleNext) {
          rafRef.current = requestAnimationFrame((nextNow) => tick(nextNow, true));
        }
        return;
      }

      const minFrameInterval = st.hasFocusedInput
        ? INPUT_FOCUSED_FRAME_INTERVAL_MS
        : FRAME_INTERVAL_MS;
      if (st.lastFrameAt > 0 && now - st.lastFrameAt < minFrameInterval) {
        if (scheduleNext) {
          rafRef.current = requestAnimationFrame((nextNow) => tick(nextNow, true));
        }
        return;
      }
      st.lastFrameAt = now;

      const t = (now - t0) * 0.001 * speed;
      const ta1 = 0.15 * t;
      const tb1 = -0.12 * t;
      const ta2 = -0.11 * t;
      const tb2 = 0.14 * t;
      const meshTx = 0.12 * t;
      const meshTy = -0.1 * t;

      const colorAr = parsedColors.color1.r;
      const colorAg = parsedColors.color1.g;
      const colorAb = parsedColors.color1.b;
      const colorBr = parsedColors.color2.r;
      const colorBg = parsedColors.color2.g;
      const colorBb = parsedColors.color2.b;

      let pixelOffset = 0;
      let idx = 0;

      for (let y = 0; y < ih; y += 1) {
        const v = vAxis[y];

        for (let x = 0; x < iw; x += 1) {
          const u = uAxis[x];

          const warp1 = fbm(u * 3.2 + ta1, v * 3.2 + tb1);
          const warp2 = fbm(u * 5.1 + ta2, v * 5.1 + tb2);

          const su = u + (warp1 - 0.5) * 0.18 + (warp2 - 0.5) * 0.08;
          const sv = v + (warp2 - 0.5) * 0.18 - (warp1 - 0.5) * 0.08;

          const g1 = Math.sin((su * 2.6 + sv * 1.4) * Math.PI + t * 0.8) * 0.5 + 0.5;
          const g2 = Math.cos((su * 1.1 - sv * 2.2) * Math.PI - t * 0.6) * 0.5 + 0.5;
          const mesh = fbm(su * 9 + meshTx, sv * 9 + meshTy);

          let lum = (0.55 * g1 + 0.35 * g2 + 0.35 * mesh) * vignette[idx];
          if (lum < 0) lum = 0;
          if (lum > 1) lum = 1;

          const pickB = lum > threshold[idx];

          buf[pixelOffset] = pickB ? colorBr : colorAr;
          buf[pixelOffset + 1] = pickB ? colorBg : colorAg;
          buf[pixelOffset + 2] = pickB ? colorBb : colorAb;
          buf[pixelOffset + 3] = 255;

          pixelOffset += 4;
          idx += 1;
        }
      }

      drawCtx.putImageData(imageData, 0, 0);

      if (scheduleNext) {
        rafRef.current = requestAnimationFrame((nextNow) => tick(nextNow, true));
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    resize();
    st.t0 = performance.now();
    cancelAnimationFrame(rafRef.current);
    tick(st.t0, false);
    rafRef.current = requestAnimationFrame((nextNow) => tick(nextNow, true));

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, [colorA, parsedColors, pixelSize, quality, speed]);

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
});

export default DitherMeshGradient;

export const DitherMeshGradientFill = memo(function DitherMeshGradientFill(props) {
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
});
