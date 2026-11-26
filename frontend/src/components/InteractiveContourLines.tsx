import { useEffect, useMemo, useRef } from "react";
import { useAnimationFrame, useMotionValue, useSpring } from "motion/react";

interface CubicSpec {
  p0: [number, number];
  p1: [number, number];
  p2: [number, number];
  p3: [number, number];
}

interface SamplePoint {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

interface WaveRipple {
  x: number;
  y: number;
  t0: number;
  amp: number;
}

/** Exact flowing diagonal contour curves matching contour-mono.svg (1440 x 900 viewBox). */
const CONTOUR_CURVES: CubicSpec[] = [
  { p0: [-40, 120], p1: [180, 40], p2: [360, -20], p3: [520, -40] },
  { p0: [-40, 250], p1: [220, 150], p2: [460, 60], p3: [720, -40] },
  { p0: [-40, 390], p1: [260, 280], p2: [560, 150], p3: [920, -40] },
  { p0: [-40, 530], p1: [310, 420], p2: [660, 270], p3: [1120, -40] },
  { p0: [-40, 690], p1: [360, 560], p2: [780, 420], p3: [1480, 60] },
  { p0: [-40, 830], p1: [420, 710], p2: [920, 580], p3: [1480, 230] },
  { p0: [220, 940], p1: [620, 810], p2: [1060, 720], p3: [1480, 410] },
  { p0: [580, 940], p1: [920, 850], p2: [1220, 790], p3: [1480, 610] },
  { p0: [860, -40], p1: [1060, 40], p2: [1260, 120], p3: [1480, 210] },
  { p0: [640, -40], p1: [920, 90], p2: [1190, 220], p3: [1480, 350] },
];

function evalCubic(c: CubicSpec, t: number): [number, number] {
  const u = 1 - t;
  const b0 = u * u * u;
  const b1 = 3 * u * u * t;
  const b2 = 3 * u * t * t;
  const b3 = t * t * t;
  return [
    b0 * c.p0[0] + b1 * c.p1[0] + b2 * c.p2[0] + b3 * c.p3[0],
    b0 * c.p0[1] + b1 * c.p1[1] + b2 * c.p2[1] + b3 * c.p3[1],
  ];
}

function sampleCurve(c: CubicSpec, steps = 42): SamplePoint[] {
  const raw: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    raw.push(evalCubic(c, i / steps));
  }
  return raw.map(([x, y], i) => {
    const prev = raw[Math.max(0, i - 1)];
    const next = raw[Math.min(steps, i + 1)];
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    return { x, y, nx: -ty / len, ny: tx / len };
  });
}

function pointsToSmoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) * 0.5;
    const my = (pts[i][1] + pts[i + 1][1]) * 0.5;
    d += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}, ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` T ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  return d;
}

export function InteractiveContourLines() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const ripplesRef = useRef<WaveRipple[]>([]);
  const lastSpawnRef = useRef<{ x: number; y: number; t: number }>({ x: -999, y: -999, t: 0 });
  const activeRef = useRef(0);

  const pointerX = useMotionValue(-9999);
  const pointerY = useMotionValue(-9999);
  const smoothX = useSpring(pointerX, { stiffness: 180, damping: 22, mass: 0.55 });
  const smoothY = useSpring(pointerY, { stiffness: 180, damping: 22, mass: 0.55 });

  const sampledCurves = useMemo(() => CONTOUR_CURVES.map((c) => sampleCurve(c, 42)), []);
  const initialPaths = useMemo(
    () => sampledCurves.map((pts) => pointsToSmoothPath(pts.map((p) => [p.x, p.y]))),
    [sampledCurves]
  );

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const toSvgCoords = (clientX: number, clientY: number): [number, number] | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const scale = Math.max(rect.width / 1440, rect.height / 900);
      const renderedW = 1440 * scale;
      const renderedH = 900 * scale;
      const offsetX = (rect.width - renderedW) * 0.5;
      const offsetY = (rect.height - renderedH) * 0.5;
      return [
        (clientX - rect.left - offsetX) / scale,
        (clientY - rect.top - offsetY) / scale,
      ];
    };

    const onMove = (e: PointerEvent) => {
      const coords = toSvgCoords(e.clientX, e.clientY);
      if (!coords) return;
      const [sx, sy] = coords;
      pointerX.set(sx);
      pointerY.set(sy);
      activeRef.current = 1;

      const now = performance.now() / 1000;
      const prev = lastSpawnRef.current;
      const moved = Math.hypot(sx - prev.x, sy - prev.y);
      if (moved > 22 && now - prev.t > 0.035) {
        const speedAmp = Math.min(24, Math.max(9, moved * 0.34));
        ripplesRef.current.push({ x: sx, y: sy, t0: now, amp: speedAmp });
        if (ripplesRef.current.length > 14) {
          ripplesRef.current.shift();
        }
        lastSpawnRef.current = { x: sx, y: sy, t: now };
      }
    };

    const onLeave = () => {
      activeRef.current = 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [pointerX, pointerY]);

  useAnimationFrame((timeMs) => {
    const t = timeMs / 1000;
    const ripples = ripplesRef.current;
    // Prune expired ripples (> 1.8s)
    while (ripples.length > 0 && t - ripples[0].t0 > 1.8) {
      ripples.shift();
    }

    activeRef.current *= 0.965;
    const wakeStrength = activeRef.current;
    if (ripples.length === 0 && wakeStrength < 0.01) {
      return;
    }

    const cx = smoothX.get();
    const cy = smoothY.get();

    for (let cIdx = 0; cIdx < sampledCurves.length; cIdx++) {
      const pathEl = pathRefs.current[cIdx];
      if (!pathEl) continue;
      const basePts = sampledCurves[cIdx];
      const displaced: [number, number][] = new Array(basePts.length);

      for (let i = 0; i < basePts.length; i++) {
        const bp = basePts[i];
        let offset = 0;

        // Live spring-coupled cursor ripple aura
        if (wakeStrength > 0.01) {
          const dx = bp.x - cx;
          const dy = bp.y - cy;
          const distSq = dx * dx + dy * dy;
          if (distSq < 48400) {
            const dist = Math.sqrt(distSq);
            const env = Math.exp(-distSq / (2 * 95 * 95));
            offset += 15 * wakeStrength * env * Math.sin(dist * 0.055 - t * 9.5);
          }
        }

        // Propagating concentric wave rings
        for (let r = 0; r < ripples.length; r++) {
          const w = ripples[r];
          const age = t - w.t0;
          if (age < 0) continue;
          const dx = bp.x - w.x;
          const dy = bp.y - w.y;
          const dist = Math.hypot(dx, dy);
          const front = age * 390;
          const delta = dist - front;
          if (Math.abs(delta) < 155) {
            const spatial = Math.exp(-(delta * delta) / (2 * 56 * 56));
            const decay = Math.exp(-1.85 * age);
            offset += w.amp * spatial * decay * Math.sin(delta * 0.075);
          }
        }

        displaced[i] = [bp.x + bp.nx * offset, bp.y + bp.ny * offset];
      }

      pathEl.setAttribute("d", pointsToSmoothPath(displaced));
    }
  });

  return (
    <svg
      ref={svgRef}
      className="interactive-contour-svg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" strokeWidth="5.2" strokeLinecap="round" className="interactive-contour-strokes">
        {initialPaths.map((d, idx) => (
          <path
            key={idx}
            ref={(el) => {
              pathRefs.current[idx] = el;
            }}
            d={d}
          />
        ))}
      </g>
    </svg>
  );
}
