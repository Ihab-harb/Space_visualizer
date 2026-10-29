import type { ReactNode } from 'react';
import type { Atmosphere, BodyDetails, Gas, InteriorLayer, Magnetosphere, Mission, SourcedRange } from '../core/details/schema';
import { useDetailsStore, type DetailsEntry } from '../state/detailsStore';
import { formatNumber } from './format';

type Cite = (sourceId: string) => ReactNode;

const MAX_FEATURES = 10;
const SUBSCRIPT: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const subscripts = (formula: string) => formula.replace(/\d/g, (d) => SUBSCRIPT[d] ?? d);
const rangeText = (min: number, max: number) => (min === max ? formatNumber(min) : `${formatNumber(min)}–${formatNumber(max)}`);
/** Uncertainties: percent values are written to one decimal in the sheets; ppm values are whole numbers as written. */
const uncertaintyText = (gas: Gas) => (gas.unit === '%' ? gas.uncertainty!.toFixed(1) : formatNumber(gas.uncertainty!));
const latText = (lat: number) => `${Math.abs(lat)}° ${lat < 0 ? 'S' : 'N'}`;
const uniq = (ids: string[]) => [...new Set(ids)];

/** One interior bound in the form its source states it: a depth, a radius, a percent of the radius, or the surface or centre. */
function boundText(r: SourcedRange): string {
  const form = r.from ?? 'radius';
  const stated = r.stated ?? { min: r.min, max: r.max };
  if (stated.min === 0 && stated.max === 0) return form === 'depth' ? 'the surface' : 'the centre';
  const range = rangeText(stated.min, stated.max);
  if (form === 'depth') return `${range} km deep`;
  if (form === 'percent') return `${range} % of the radius`;
  return `radius ${range} km`;
}

/**
 * Interior display rule: each layer reads outside in, "from <outer bound> to <inner bound>", and every bound is printed in
 * the form and with the numbers its source states (km deep, radius in km, or percent of the radius), never a derived figure.
 * The stored radii are untouched; they are for the cutaway, not for display.
 */
function layerExtent(layer: InteriorLayer): string {
  const { outerRadiusKm: outer, innerRadiusKm: inner } = layer;
  const stated = (r: SourcedRange) => r.stated ?? { min: r.min, max: r.max };
  const isCentre = (r: SourcedRange) => stated(r).min === 0 && stated(r).max === 0;
  if (outer.from === 'percent' && inner.from === 'percent' && !isCentre(inner)) {
    const pct = (r: SourcedRange) => `${rangeText(stated(r).min, stated(r).max)} %`;
    return `from ${pct(outer)} to ${pct(inner)} of the radius`;
  }
  return `from ${boundText(outer)} to ${boundText(inner)}`;
}

function Interior({ layers, cite }: { layers: InteriorLayer[]; cite: Cite }) {
  return (
    <ul className="details-list">
      {layers.map((layer) => (
        <li key={layer.id} className="details-row">
          <strong>{layer.name}</strong>
          <span className="num">{layerExtent(layer)}</span>
          {uniq([layer.outerRadiusKm.sourceId, layer.innerRadiusKm.sourceId]).map((id) => (
            <span key={id}>{cite(id)}</span>
          ))}
          <span className="tag">{layer.state}</span>
          {layer.stateSourceId && cite(layer.stateSourceId)}
          {layer.uncertain && <span className="tag uncertain">uncertain</span>}
          {layer.composition && (
            <span className="details-row__text">
              {layer.composition.text}
              {cite(layer.composition.sourceId)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function AtmosphereBlock({ atmosphere, cite }: { atmosphere: Atmosphere; cite: Cite }) {
  const gas = (g: Gas) => (
    <li key={`${g.unit}-${g.formula}-${g.name}`} className="details-row">
      <span>
        {g.name} ({subscripts(g.formula)})
      </span>{' '}
      <span className="num">
        {formatNumber(g.amount)}
        {g.unit === '%' ? '%' : ` ${g.unit}`}
        {g.uncertainty !== null && ` ± ${uncertaintyText(g)}`}
      </span>
      {cite(g.sourceId)}
    </li>
  );
  const density = atmosphere.numberDensity ?? [];
  const hasGases = atmosphere.major.length + atmosphere.minor.length + density.length > 0;
  const basis = atmosphere.kind === 'exosphere' ? `Estimated composition (${atmosphere.basis})` : atmosphere.basis;
  return (
    <>
      {hasGases && <p className="info-panel__note">{basis}</p>}
      {density.length > 0 && (
        <ul className="details-list">
          {density.map((g) => (
            <li key={`${g.formula}-${g.name}`} className="details-row">
              <span>
                {g.name} ({subscripts(g.formula)})
              </span>{' '}
              <span className="num">
                {formatNumber(g.amount)} per cm³{g.upperLimit && ' (upper limit)'}
              </span>
              {cite(g.sourceId)}
            </li>
          ))}
        </ul>
      )}
      {atmosphere.major.length > 0 && <ul className="details-list">{atmosphere.major.map(gas)}</ul>}
      {atmosphere.minor.length > 0 && (
        <>
          <p className="details-subhead">Minor gases</p>
          <ul className="details-list">{atmosphere.minor.map(gas)}</ul>
        </>
      )}
      {atmosphere.note && (
        <p className="info-panel__note">
          {atmosphere.note.text}
          {cite(atmosphere.note.sourceId)}
        </p>
      )}
    </>
  );
}

function MagneticField({ field, cite }: { field: Magnetosphere; cite: Cite }) {
  if (field.kind === 'none') {
    return (
      <p className="details-row">
        No global magnetic field
        {cite(field.sourceId)}
      </p>
    );
  }
  if (field.kind === 'other') {
    return (
      <p className="details-row">
        {field.note.text}
        {cite(field.note.sourceId)}
      </p>
    );
  }
  const rows: Array<[string, string, string]> = [['Dipole strength', `${formatNumber(field.strengthGaussR3.value)} G·R³`, field.strengthGaussR3.sourceId]];
  if (field.tiltDeg) rows.push(['Tilt from spin axis', `${field.tiltDeg.value}°`, field.tiltDeg.sourceId]);
  if (field.tiltLongitudeDeg) rows.push(['Tilt longitude', `${field.tiltLongitudeDeg.value}°`, field.tiltLongitudeDeg.sourceId]);
  if (field.dipolePole) rows.push(['Dipole pole', `${latText(field.dipolePole.latDeg)}, ${field.dipolePole.lonDegE}° E`, field.dipolePole.sourceId]);
  if (field.offsetRadii) rows.push(['Dipole offset', `${field.offsetRadii.value} R`, field.offsetRadii.sourceId]);
  if (field.surfaceFieldGauss) rows.push(['Surface field', `${rangeText(field.surfaceFieldGauss.min, field.surfaceFieldGauss.max)} G`, field.surfaceFieldGauss.sourceId]);
  return (
    <>
      <dl className="facts">
        {rows.map(([label, value, sourceId]) => (
          <div className="facts__row" key={label}>
            <dt>{label}</dt>
            <dd>
              {value}
              {cite(sourceId)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="info-panel__note">
        R is the reference radius, {formatNumber(field.referenceRadiusKm.value)} km.
        {cite(field.referenceRadiusKm.sourceId)}
      </p>
    </>
  );
}

function MissionRow({ mission, cite }: { mission: Mission; cite: Cite }) {
  return (
    <li className="details-row">
      <strong>{mission.name}</strong>
      <span className="details-row__text">{mission.agency}</span>
      <span className="tag">{mission.type}</span>
      <span className={`tag tag--${mission.outcome}`}>{mission.outcome}</span>
      <span className="num details-row__text">
        Launched {mission.launchDate}
        {mission.arrivalDate && ` · arrived ${mission.arrivalDate}`}
        {cite(mission.sourceId)}
      </span>
    </li>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`details-${id}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Ready({ details, cite }: { details: BodyDetails; cite: Cite }) {
  const { interior, atmosphere, missions, discovery, features } = details;
  const shown = features ? [...features.items].sort((a, b) => b.diameterKm - a.diameterKm).slice(0, MAX_FEATURES) : [];
  return (
    <>
      {interior && (
        <Section id="interior" title="Interior">
          <Interior layers={interior.layers} cite={cite} />
        </Section>
      )}
      {atmosphere && (
        <Section id="atmosphere" title={atmosphere.kind === 'exosphere' ? 'Exosphere' : 'Atmosphere'}>
          <AtmosphereBlock atmosphere={atmosphere} cite={cite} />
        </Section>
      )}
      <Section id="magnetosphere" title="Magnetic field">
        <MagneticField field={details.magnetosphere} cite={cite} />
      </Section>
      {missions.length > 0 && (
        <Section id="missions" title="Key missions">
          <ul className="details-list">
            {[...missions]
              .sort((a, b) => a.launchDate.localeCompare(b.launchDate))
              .map((m) => (
                <MissionRow key={m.id} mission={m} cite={cite} />
              ))}
          </ul>
        </Section>
      )}
      {discovery && (
        <Section id="discovery" title="Discovery">
          <p className="details-row">
            {discovery.kind === 'antiquity' ? 'Known since antiquity' : `Discovered by ${discovery.by} on ${discovery.date}`}
            {cite(discovery.sourceId)}
          </p>
        </Section>
      )}
      {features && shown.length > 0 && (
        <Section id="features" title="Named features">
          <ul className="details-list">
            {shown.map((f) => (
              <li key={`${f.name}-${f.latDeg}-${f.lonDegE}`} className="details-row">
                <strong>{f.name}</strong> · {f.type} · <span className="num">{formatNumber(f.diameterKm)} km</span> ·{' '}
                <span className="num">
                  {latText(f.latDeg)}, {f.lonDegE}° E
                </span>
                {cite(features.sourceId)}
              </li>
            ))}
          </ul>
          <p className="info-panel__note">
            Showing {shown.length} of {formatNumber(features.totalApproved.value)} approved features (≥ {formatNumber(features.thresholdKm)} km)
            {cite(features.totalApproved.sourceId)}
          </p>
        </Section>
      )}
    </>
  );
}

/** The drawer's per-body details: loading, unavailable-with-retry, or the cited sections. A null part of the data renders no section. */
export function DetailsSections({ body, entry, cite }: { body: { id: string }; entry: DetailsEntry | undefined; cite: Cite }) {
  if (!entry || entry.status === 'loading') {
    return (
      <p role="status" className="info-panel__note">
        Loading details…
      </p>
    );
  }
  if (entry.status !== 'ready') {
    return (
      <section id="details-unavailable">
        <p className="info-panel__note">Details unavailable</p>
        <button type="button" onClick={() => void useDetailsStore.getState().retry(body.id)}>
          Retry
        </button>
      </section>
    );
  }
  return <Ready details={entry.details} cite={cite} />;
}
