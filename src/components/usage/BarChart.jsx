import { useEffect, useRef, useState } from "react";

const HEIGHT = 168;
const PAD = { top: 10, right: 4, bottom: 22, left: 40 };
const GAP = 2;

/** A round axis maximum (2, 4, 6, 8, 10, 20, 40, ...) whose middle tick is a whole number. */
function niceMax(value) {
  if (value <= 2) return 2;
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 4, 6, 8, 10].find((step) => step * power >= value) * power;
}

const shortDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Bar with 4px rounded data-end, square at the baseline. */
function barPath(x, y, width, height) {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

function useWidth(ref) {
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

/**
 * Single-series daily bar chart with hover/keyboard tooltip.
 * data: [{ date, value, detail? }]   format: number -> string
 */
export default function BarChart({ data, format, label, describe }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [active, setActive] = useState(null);

  const plotWidth = Math.max(width - PAD.left - PAD.right, 10);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const column = plotWidth / data.length;
  const barWidth = Math.max(column - GAP, 1);
  const ticks = [0, max / 2, max];

  const indexFromEvent = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - PAD.left;
    return Math.min(data.length - 1, Math.max(0, Math.floor(x / column)));
  };

  const activePoint = active !== null ? data[active] : null;
  const labelEvery = Math.ceil(data.length / 6);

  return (
    <div className="bar-chart" ref={wrapRef}>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${label}. ${describe}`}
        tabIndex={0}
        onMouseMove={(event) => setActive(indexFromEvent(event))}
        onMouseLeave={() => setActive(null)}
        onFocus={() => setActive(data.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? data.length) - 1));
          if (event.key === "ArrowRight") setActive((i) => Math.min(data.length - 1, (i ?? -1) + 1));
        }}
      >
        {/* Recessive grid + y labels */}
        {ticks.map((tick) => {
          const y = PAD.top + plotHeight - (tick / max) * plotHeight;
          return (
            <g key={tick}>
              <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} />
              <text className="chart-axis" x={PAD.left - 8} y={y + 4} textAnchor="end">
                {format(tick)}
              </text>
            </g>
          );
        })}

        {data.map((point, index) => {
          const height = (point.value / max) * plotHeight;
          const x = PAD.left + index * column + GAP / 2;
          const y = PAD.top + plotHeight - height;
          return (
            <g key={point.date}>
              {point.value > 0 && (
                <path
                  className={`chart-bar ${active === index ? "active" : ""} ${active !== null && active !== index ? "dim" : ""}`}
                  d={barPath(x, y, barWidth, height)}
                />
              )}
              {(index % labelEvery === 0 || index === data.length - 1) && (
                <text className="chart-axis" x={x + barWidth / 2} y={HEIGHT - 6} textAnchor="middle">
                  {shortDate(point.date)}
                </text>
              )}
            </g>
          );
        })}

        <line
          className="chart-baseline"
          x1={PAD.left}
          x2={width - PAD.right}
          y1={PAD.top + plotHeight}
          y2={PAD.top + plotHeight}
        />
      </svg>

      {activePoint && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(PAD.left + active * column + column / 2, 70), width - 70),
          }}
          role="status"
        >
          <strong>{shortDate(activePoint.date)}</strong>
          <span>
            {format(activePoint.value)} {label.toLowerCase()}
          </span>
          {activePoint.detail && <small>{activePoint.detail}</small>}
        </div>
      )}
    </div>
  );
}
