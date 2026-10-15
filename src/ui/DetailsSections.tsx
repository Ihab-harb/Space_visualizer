import type { ReactNode } from 'react';
import type { Atmosphere, BodyDetails, InteriorLayer, Magnetosphere, Mission } from '../core/details/schema';
import { useDetailsStore, type DetailsEntry } from '../state/detailsStore';
import { formatNumber } from './format';

type Cite = (sourceId: string) => ReactNode;

const MAX_FEATURES = 10;
const SUBSCRIPT: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const subscripts = (formula: string) => formula.replace(/\d/g, (d) => SUBSCRIPT[d] ?? d);
const rangeText = (min: number, max: number) => (min === max ? formatNumber(min) : `${formatNumber(min)}–${formatNumber(max)}`);
/** Three significant figures, so 4.3 reads "4.30" and 0.00033 reads "0.000330". */
const sig3 = (n: number) => (Math.abs(n) >= 1000 ? formatNumber(n) : n.toPrecision(3));
const plain = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const latText = (lat: number) => `${Math.abs(lat)}° ${lat < 0 ? 'S' : 'N'}`;
const uniq = (ids: string[]) => [...new Set(ids)];

/**
 * Interior display rule: every layer shows its stored radii (inner to outer) as "radius a-b km". A layer whose source
 * gave depths (from === 'depth') shows "a-b km deep" instead, derived as the surface radius minus the stored radius,
 * where the surface is the largest outer radius among the layers. Every shown number is therefore a stored cited value,
 * or that value subtracted from the surface radius (and cited to the same two sources as the layer's bounds).
 */
function layerExtent(layer: InteriorLayer, surfaceKm: number): string {
  if (layer.from === 'depth') {
    const round = (n: number) => Math.round(n * 1000) / 1000;
    const top = round(surfaceKm - layer.outerRadiusKm.max);
    const bottom = round(surfaceKm - layer.innerRadiusKm.min);
    return `${rangeText(top, bottom)} km deep`;
  }
  return `radius ${rangeText(layer.innerRadiusKm.min, layer.outerRadiusKm.max)} km`;
}

function Interior({ layers, cite }: { layers: InteriorLayer[]; cite: Cite }) {
  const surfaceKm = Math.max(...layers.map((l) => l.outerRadiusKm.max));
  return (
    <ul className="details-list">
      {layers.map((layer) => (
        <li key={layer.id} className="details-row">
          <strong>{layer.name}</strong>
          <span className="num">{layerExtent(layer, surfaceKm)}</span>
          {uniq([layer.outerRadiusKm.sourceId, layer.innerRadiusKm.sourceId]).map((id) => (
            <span key={id}>{cite(id)}</span>
          ))}
          <span className="tag">{layer.state}</span>
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
  const gas = (g: Atmosphere['major'][number] | Atmosphere['minor'][number]) => (
    <li key={`${g.unit}-${g.formula}-${g.name}`} className="details-row">
      <span>
        {g.name} ({subscripts(g.formula)})
      </span>{' '}
      <span className="num">
        {formatNumber(g.amount)}
        {g.unit === '%' ? '%' : ` ${g.unit}`}
        {g.uncertainty !== null && ` ± ${plain(g.uncertainty)}`}
      </span>
      {cite(g.sourceId)}
    </li>
  );
  return (
    <>
      <p className="info-panel__note">{atmosphere.basis}</p>
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
  const rows: Array<[string, string, string]> = [['Dipole strength', `${sig3(field.strengthGaussR3.value)} G·R³`, field.strengthGaussR3.sourceId]];
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
        <Section id="atmosphere" title="Atmosphere">
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
            {discovery.kind === 'antiquity' ? 'Known since antiquity' : `Discovered by ${discovery.by} on ${discovery.date} (${discovery.method})`}
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
