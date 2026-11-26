import { useState } from "react";
import { motion } from "motion/react";
import type { CategoryBreakdownItem, TrendPoint } from "../types";
import { fmtK, fmtMoney, toNum } from "../utils/format";
import { MotionTooltip } from "./MotionPatterns";

const BLUE_BLACK_SERIES = [
  "#0352ff",
  "#0b0f17",
  "#2563eb",
  "#334155",
  "#3b82f6",
  "#1e293b",
  "#60a5fa",
  "#475569",
];

export function resolveBlueBlackColor(color: string | undefined, idx = 0): string {
  if (!color) return BLUE_BLACK_SERIES[idx % BLUE_BLACK_SERIES.length];
  return color;
}

export function DonutChart({
  data,
  size = 190,
  thickness = 24,
  currency = "USD",
}: {
  data: CategoryBreakdownItem[];
  size?: number;
  thickness?: number;
  currency?: string;
}) {
  const total = data.reduce((s, d) => s + toNum(d.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const [hover, setHover] = useState<number | null>(null);
  let offset = 0;
  const cx = size / 2;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          data.map((d, i) => {
            const val = toNum(d.value);
            const frac = val / total;
            const len = frac * c;
            const strokeColor = resolveBlueBlackColor(d.color, i);
            const segOffset = -offset;
            offset += len;
            return (
              <motion.circle
                key={d.category_id || i}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={strokeColor}
                strokeWidth={hover === i ? thickness + 4 : thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={segOffset}
                strokeLinecap="butt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.28, delay: i * 0.04 }}
                style={{ transition: "stroke-width .15s", cursor: "pointer" }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div>
          <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>
            {hover != null
              ? fmtMoney(data[hover].value, { cents: false, currency })
              : fmtMoney(total, { cents: false, currency })}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {hover != null ? data[hover].label : "Total spent"}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BarChart({
  data,
  height = 240,
  currency = "USD",
}: {
  data: TrendPoint[];
  height?: number;
  currency?: string;
}) {
  const maxVal = Math.max(100, ...data.flatMap((d) => [toNum(d.income), toNum(d.expense)])) * 1.1;
  const ticks = 4;

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height,
          paddingBottom: 22,
        }}
      >
        {Array.from({ length: ticks + 1 }).map((_, i) => (
          <div key={i} className="muted num" style={{ fontSize: 11.5 }}>
            {fmtK((maxVal * (ticks - i)) / ticks, currency)}
          </div>
        ))}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-end",
          height,
          position: "relative",
        }}
      >
        {Array.from({ length: ticks + 1 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: (i / ticks) * (height - 22),
              borderTop: "1px dashed var(--line)",
            }}
          />
        ))}
        {data.map((d, i) => {
          const inc = toNum(d.income);
          const exp = toNum(d.expense);
          const barH = height - 22;
          const incH = Math.max(4, (inc / maxVal) * barH);
          const expH = Math.max(4, (exp / maxVal) * barH);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height,
                gap: 6,
                position: "relative",
                zIndex: 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: barH }}>
                <MotionTooltip content={`${d.month} Income: ${fmtMoney(inc, { cents: false, currency })}`}>
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.32, delay: i * 0.035, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      width: 16,
                      height: incH,
                      transformOrigin: "bottom",
                      background: "var(--chart-inc)",
                      borderRadius: "6px 6px 0 0",
                    }}
                  />
                </MotionTooltip>
                <MotionTooltip content={`${d.month} Expenses: ${fmtMoney(exp, { cents: false, currency })}`}>
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.32, delay: i * 0.035 + 0.04, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      width: 16,
                      height: expH,
                      transformOrigin: "bottom",
                      background: "var(--chart-exp)",
                      borderRadius: "6px 6px 0 0",
                    }}
                  />
                </MotionTooltip>
              </div>
              <div className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>
                {d.month}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LineChart({ data, height = 190 }: { data: TrendPoint[]; height?: number }) {
  if (!data.length) return null;
  const w = 520;
  const pad = 10;
  const allMax = Math.max(100, ...data.flatMap((d) => [toNum(d.income), toNum(d.expense)])) * 1.08;
  const span = Math.max(1, data.length - 1);
  const xs = (i: number) => pad + (i * (w - pad * 2)) / span;
  const ys = (v: number) => height - pad - (v / allMax) * (height - pad * 2);
  const path = (key: "income" | "expense") =>
    data
      .map((d, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ys(toNum(d[key])).toFixed(1)}`)
      .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <motion.path
        d={path("income")}
        fill="none"
        stroke="var(--chart-inc)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.path
        d={path("expense")}
        fill="none"
        stroke="var(--chart-exp)"
        strokeWidth="2.6"
        strokeDasharray="5 4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.55, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      />
      {data.map((d, i) => (
        <g key={i}>
          <circle
            cx={xs(i)}
            cy={ys(toNum(d.income))}
            r="3.8"
            fill="var(--surface)"
            stroke="var(--chart-inc)"
            strokeWidth="2.2"
          />
          <circle
            cx={xs(i)}
            cy={ys(toNum(d.expense))}
            r="3.8"
            fill="var(--surface)"
            stroke="var(--chart-exp)"
            strokeWidth="2.2"
          />
        </g>
      ))}
    </svg>
  );
}
