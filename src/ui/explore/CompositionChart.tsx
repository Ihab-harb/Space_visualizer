import { useId, useState, type ReactNode } from 'react';
import type { Catalog } from '../../core/catalog/catalog';
import type { Body } from '../../core/catalog/schema';
import type { BodyDetails } from '../../core/details/schema';
import { citationModel } from '../citations';
import { formatNumber } from '../format';
import { compositionModel, compositionPreview, type ChartBar, type ChartModel } from './compositionModel';

export interface CompositionChartProps {
  catalog: Catalog;
  body: Body;
  /** Null or undefined (still loading) renders nothing. */
  details: BodyDetails | null | undefined;
}

const W = 640;
const NAME_W = 170;
const PLOT_W = 340;
const LABEL_GAP = 8;
const CITE_X = W - 8;
const ROW_H = 26;
const BAR_H = 8;
const TOP = 6;
const AXIS_H = 30;

const unitName = (unit: ChartBar['unit']) => (unit === 'cm⁻³' ? 'per cm³' : unit);
const uncertaintyText = (b: ChartBar) => (b.uncertainty === null ? null : `± ${formatNumber(b.uncertainty)} ${unitName(b.unit)}`);
const spoken = (b: ChartBar) => `${b.name}, ${b.label}${b.upperLimit ? ', upper limit' : ''}`;

type Numbers = ReadonlyMap<string, number>;

/** The same superscript `[n]` link the facts drawer uses. */
function Cite({ sourceId, numbers }: { sourceId: string; numbers: Numbers }) {
  return (
    <sup className="cite">
      <a href={`#source-${sourceId}`} aria-label={`Source ${numbers.get(sourceId)}`}>
        [{numbers.get(sourceId)}]
      </a>
    </sup>
  );
}

export function CompositionChart({ catalog, body, details }: CompositionChartProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [active, setActive] = useState<number | null>(null);
  const uid = useId();
  if (!details) return null;

  const { numbers } = citationModel(catalog, body, details);
  const model = compositionModel(body, details);
  if (!model) {
    const { parts } = compositionPreview(null, details);
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

  const tableView = view === 'table';
  return (
    <div className="composition">
      <header className="composition__header">
        <h3 className="composition__title">{model.title}</h3>
        <button type="button" className="composition__toggle" aria-pressed={tableView} onClick={() => setView(tableView ? 'chart' : 'table')}>
          Table
        </button>
      </header>
      {tableView ? (
        <BarTable model={model} numbers={numbers} />
      ) : (
        <BarChart model={model} numbers={numbers} uid={uid} active={active} setActive={setActive} sourceTitle={(id) => catalog.sources.get(id)?.title ?? id} />
      )}
      {model.note && (
        <p className="info-panel__note composition__note">
          {model.note.text}
          <Cite sourceId={model.note.sourceId} numbers={numbers} />
        </p>
      )}
    </div>
  );
}

function BarChart({ model, numbers, uid, active, setActive, sourceTitle }: {
  model: ChartModel;
  numbers: Numbers;
  uid: string;
  active: number | null;
  setActive: (i: number | null) => void;
  sourceTitle: (id: string) => string;
}): ReactNode {
  const lo = Math.log10(model.ticks[0]!.value);
  const hi = Math.log10(model.ticks.at(-1)!.value);
  const x = (log: number) => NAME_W + ((log - lo) / (hi - lo)) * PLOT_W;
  const plotBottom = TOP + model.bars.length * ROW_H;
  const H = plotBottom + AXIS_H;
  const axisName = model.axis === 'ppm' ? 'parts per million (1 % = 10,000 ppm), logarithmic' : 'particles per cm³, logarithmic';
  const description = `Ranked bars on one logarithmic scale, ${axisName}. ${model.bars.map(spoken).join('; ')}.`;
  const shown = active === null ? null : model.bars[active];
  const shownUncertainty = shown ? uncertaintyText(shown) : null;

  return (
    <div className="composition__plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`} className="composition__svg">
        <title id={`${uid}-t`}>{model.title}</title>
        <desc id={`${uid}-d`}>{description}</desc>
        {model.ticks.map((t) => (
          <g key={t.value} aria-hidden="true">
            <line className="composition__grid" x1={x(Math.log10(t.value))} x2={x(Math.log10(t.value))} y1={TOP} y2={plotBottom} />
            <text className="composition__tick" x={x(Math.log10(t.value))} y={plotBottom + 14} textAnchor="middle">
              {t.label}
            </text>
          </g>
        ))}
        <text className="composition__axis-title" x={NAME_W + PLOT_W / 2} y={plotBottom + 27} textAnchor="middle" aria-hidden="true">
          {model.axis === 'ppm' ? 'ppm (1 % = 10,000 ppm)' : 'particles per cm³'}
        </text>
        {model.bars.map((b, i) => {
          const y = TOP + i * ROW_H;
          const mid = y + ROW_H / 2;
          const end = x(b.logValue);
          const n = numbers.get(b.sourceId);
          return (
            <g key={`${b.formula}-${b.name}`}>
              <g
                role="listitem"
                tabIndex={0}
                aria-label={spoken(b)}
                className={active === i ? 'composition__row is-active' : 'composition__row'}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <rect x={0} y={y} width={CITE_X - 28} height={ROW_H} fill="transparent" />
                <text className="composition__name" x={0} y={mid} dominantBaseline="central">
                  {b.name}
                  <tspan className="composition__formula" dx={6}>
                    {b.formula}
                  </tspan>
                </text>
                <rect className="composition__bar" x={NAME_W} y={mid - BAR_H / 2} width={Math.max(end - NAME_W, 2)} height={BAR_H} rx={BAR_H / 2} />
                <text className="composition__value" x={end + LABEL_GAP} y={mid} dominantBaseline="central">
                  {b.label}
                  {b.upperLimit && <tspan className="composition__limit"> upper limit</tspan>}
                </text>
              </g>
              <a href={`#source-${b.sourceId}`} aria-label={`Source ${n}`}>
                <text className="composition__cite" x={CITE_X} y={mid} textAnchor="end" dominantBaseline="central">
                  [{n}]
                </text>
              </a>
            </g>
          );
        })}
      </svg>
      {shown && (
        <div role="tooltip" className="composition__tooltip" style={{ left: `${(x(shown.logValue) / W) * 100}%`, top: `${((TOP + active! * ROW_H) / H) * 100}%` }}>
          <strong>
            {shown.name} ({shown.formula})
          </strong>
          <span>
            {shown.label}
            {shown.upperLimit && ' (upper limit)'}
          </span>
          {shownUncertainty && <span>{shownUncertainty}</span>}
          <span className="composition__tooltip-source">{sourceTitle(shown.sourceId)}</span>
        </div>
      )}
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
              {b.upperLimit && ' (upper limit)'}
            </td>
            <td className="num">{uncertaintyText(b) ?? '—'}</td>
            <td>
              <Cite sourceId={b.sourceId} numbers={numbers} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
