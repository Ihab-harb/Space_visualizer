import { createContext, useContext, useId, useState, type CSSProperties, type ReactNode } from "react";
import type { Catalog } from "../../core/catalog/catalog";
import type { Body } from "../../core/catalog/schema";
import type { BodyDetails } from "../../core/details/schema";
import { citationModel } from "../citations";
import { formatNumber } from "../format";
import {
  compositionModel,
  compositionPreview,
  type ChartBar,
  type ChartModel,
} from "./compositionModel";

export interface CompositionChartProps {
  catalog: Catalog;
  body: Body;
  /** Null or undefined (still loading) renders nothing. */
  details: BodyDetails | null | undefined;
}

const unitName = (unit: ChartBar["unit"]) =>
  unit === "cm⁻³" ? "per cm³" : unit;
const uncertaintyText = (b: ChartBar) =>
  b.uncertainty === null
    ? null
    : `± ${formatNumber(b.uncertainty)} ${unitName(b.unit)}`;
const spoken = (b: ChartBar) =>
  `${b.name}, ${b.label}${b.upperLimit ? ", upper limit" : ""}`;

type Numbers = ReadonlyMap<string, number>;

/**
 * Where a `[n]` link points and what it says on hover. The facts drawer (the default) lists its sources as `#source-<id>`. In
 * Explore the drawer is not on screen, so the overlay sets a target that is: the chart panel's Sources list
 * (`#chart-source-<id>`) with a tooltip naming the source, and `follow` opens that panel first (the strip).
 */
export interface CiteTarget {
  prefix: string;
  title?: (sourceId: string) => string | undefined;
  follow?: (sourceId: string) => void;
}
export const CiteTargetContext = createContext<CiteTarget>({ prefix: "source-" });

/** The same superscript `[n]` link the facts drawer uses. */
export function Cite({
  sourceId,
  numbers,
  forName,
}: {
  sourceId: string;
  numbers: Numbers;
  forName?: string;
}) {
  const target = useContext(CiteTargetContext);
  return (
    <sup className="cite">
      <a
        href={`#${target.prefix}${sourceId}`}
        title={target.title?.(sourceId)}
        onClick={
          target.follow
            ? (e) => {
                e.preventDefault();
                target.follow!(sourceId);
              }
            : undefined
        }
        aria-label={
          forName
            ? `Source ${numbers.get(sourceId)} for ${forName}`
            : `Source ${numbers.get(sourceId)}`
        }
      >
        [{numbers.get(sourceId)}]
      </a>
    </sup>
  );
}

export function CompositionChart({
  catalog,
  body,
  details,
}: CompositionChartProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [active, setActive] = useState<number | null>(null);
  const uid = useId();
  if (!details) return null;

  const { numbers } = citationModel(catalog, body, details);
  const model = compositionModel(body, details);
  if (!model) {
    const { parts } = compositionPreview(null, details, body);
    return (
      <div className="composition composition--empty">
        <p className="info-panel__note">
          {parts.map((p, i) => (
            <span key={i}>
              {p.text}
              {p.sourceId && <Cite sourceId={p.sourceId} numbers={numbers} />}
            </span>
          ))}
        </p>
      </div>
    );
  }

  const tableView = view === "table";
  return (
    <div className="composition-box">
      <div className="composition">
        <header className="composition__header">
          <h3 className="composition__title">{model.title}</h3>
          <button
            type="button"
            className="composition__toggle"
            aria-pressed={tableView}
            onClick={() => setView(tableView ? "chart" : "table")}
          >
            Table
          </button>
        </header>
        {tableView ? (
          <BarTable model={model} numbers={numbers} />
        ) : (
          <BarChart
            model={model}
            numbers={numbers}
            uid={uid}
            active={active}
            setActive={setActive}
            sourceTitle={(id) => catalog.sources.get(id)?.title ?? id}
          />
        )}
        {model.note && (
          <p className="info-panel__note composition__note">
            {model.note.text}
            <Cite sourceId={model.note.sourceId} numbers={numbers} />
          </p>
        )}
      </div>
    </div>
  );
}

function BarChart({
  model,
  numbers,
  uid,
  active,
  setActive,
  sourceTitle,
}: {
  model: ChartModel;
  numbers: Numbers;
  uid: string;
  active: number | null;
  setActive: (i: number | null) => void;
  sourceTitle: (id: string) => string;
}): ReactNode {
  const lo = Math.log10(model.ticks[0]!.value);
  const hi = Math.log10(model.ticks.at(-1)!.value);
  const frac = (log: number) => (log - lo) / (hi - lo);
  const axisName =
    model.axis === "ppm"
      ? "parts per million (1 % = 10,000 ppm), logarithmic"
      : "particles per cm³, logarithmic";
  const description = `Ranked bars on one logarithmic scale, ${axisName}. The table view lists the same values.`;

  // The layout is HTML, so text keeps its size at any width; only the bars scale. Three columns: name, plot, citation.
  return (
    <div className="composition__plot">
      <p id={`${uid}-d`} className="visually-hidden">
        {description}
      </p>
      <div className="composition__grid-lines" aria-hidden="true">
        {model.ticks.map((t) => (
          <span
            key={t.value}
            className="composition__gridline"
            style={{ left: `${frac(Math.log10(t.value)) * 100}%` }}
          />
        ))}
      </div>
      <div
        role="list"
        aria-label={model.title}
        aria-describedby={`${uid}-d`}
        className="composition__rows"
      >
        {model.bars.map((b, i) => {
          const f = frac(b.logValue);
          const shown = active === i;
          const tipClass = [
            "composition__tooltip",
            i === 0 ? "composition__tooltip--below" : "",
            f > 0.5 ? "composition__tooltip--end" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const uncertainty = uncertaintyText(b);
          return (
            <div
              key={`${b.formula}-${b.name}`}
              role="listitem"
              tabIndex={0}
              aria-label={spoken(b)}
              className={
                shown ? "composition__row is-active" : "composition__row"
              }
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <span className="composition__name" aria-hidden="true">
                {b.name}{" "}
                <span className="composition__formula">{b.formula}</span>
              </span>
              <span className="composition__track" aria-hidden="true">
                <span className="composition__scale">
                  <span
                    className="composition__bar"
                    style={{ width: `${Math.max(f * 100, 1)}%` }}
                  />
                  <span
                    className="composition__value"
                    style={{ left: `${f * 100}%` }}
                  >
                    {b.upperLimit && (
                      <span className="composition__limit">≤ </span>
                    )}
                    {b.label}
                  </span>
                </span>
              </span>
              <Cite sourceId={b.sourceId} numbers={numbers} forName={b.name} />
              {shown && (
                <div
                  role="tooltip"
                  className={tipClass}
                  style={{ "--bar-end": f } as CSSProperties}
                >
                  <strong>
                    {b.name} ({b.formula})
                  </strong>
                  <span>
                    {b.label}
                    {b.upperLimit && " (upper limit)"}
                  </span>
                  {uncertainty && <span>{uncertainty}</span>}
                  <span className="composition__tooltip-source">
                    {sourceTitle(b.sourceId)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="composition__axis" aria-hidden="true">
        <div className="composition__ticks">
          {model.ticks.map((t, i) => (
            <span
              key={t.value}
              className="composition__tick"
              data-minor={
                (model.ticks.length - 1 - i) % 2 === 1 ? "" : undefined
              }
              style={{ left: `${frac(Math.log10(t.value)) * 100}%` }}
            >
              <span className="composition__tick-full">{t.label}</span>
              <span className="composition__tick-short" aria-hidden="true">
                {shortTick(t.value)}
              </span>
            </span>
          ))}
        </div>
        <div className="composition__axis-title">
          {model.axis === "ppm"
            ? "ppm (1 % = 10,000 ppm)"
            : "particles per cm³"}
        </div>
      </div>
    </div>
  );
}

function BarTable({ model, numbers }: { model: ChartModel; numbers: Numbers }) {
  return (
    <table className="composition__table">
      <caption className="visually-hidden">{model.title}</caption>
      <thead>
        <tr>
          <th scope="col">Gas</th>
          <th scope="col">Formula</th>
          <th scope="col">Amount</th>
          <th scope="col">Uncertainty</th>
          <th scope="col">Source</th>
        </tr>
      </thead>
      <tbody>
        {model.bars.map((b) => (
          <tr key={`${b.formula}-${b.name}`}>
            <th scope="row">{b.name}</th>
            <td>{b.formula}</td>
            <td className="num">
              {b.label}
              {b.upperLimit && " (upper limit)"}
            </td>
            <td className="num">{uncertaintyText(b) ?? "—"}</td>
            <td>
              <Cite sourceId={b.sourceId} numbers={numbers} forName={b.name} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A short tick label for narrow containers: 1,000 becomes 1k, 1,000,000 becomes 1M. */
function shortTick(value: number): string {
  if (value >= 1e6) return `${value / 1e6}M`;
  if (value >= 1e3) return `${value / 1e3}k`;
  return formatNumber(value);
}
