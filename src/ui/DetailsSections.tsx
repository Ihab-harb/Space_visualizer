import type { ReactNode } from 'react';
import type { Atmosphere, BodyDetails, Gas, InteriorLayer, Magnetosphere, Mission } from '../core/details/schema';
import { useDetailsStore, type DetailsEntry } from '../state/detailsStore';
import { formatNumber, subscripts } from './format';
import { layerExtent, layerLabelText } from './interiorText';

type Cite = (sourceId: string) => ReactNode;

const MAX_FEATURES = 10;
const rangeText = (min: number, max: number) => (min === max ? formatNumber(min) : `${formatNumber(min)}–${formatNumber(max)}`);
/** Uncertainties: percent values are written to one decimal in the sheets; ppm values are whole numbers as written. */
const uncertaintyText = (gas: Gas) => (gas.unit === '%' ? gas.uncertainty!.toFixed(1) : formatNumber(gas.uncertainty!));
const latText = (lat: number) => `${Math.abs(lat)}° ${lat < 0 ? 'S' : 'N'}`;
const uniq = (ids: string[]) => [...new Set(ids)];

function Interior({ bodyId, layers, cite }: { bodyId: string; layers: InteriorLayer[]; cite: Cite }) {
  return (
    <ul className="details-list">
      {layers.map((layer, i) => {
        const extent = layerExtent(bodyId, layer);
        // The same tags as the Explore layer card: a paper size is an estimate; an unsized layer has an illustrative size.
        const { tag } = layerLabelText(bodyId, layer, i === layers.length - 1);
        return (
          <li key={layer.id} className="details-row">
            <strong>{layer.name}</strong>
            {extent && <span className="num">{extent}</span>}
            {uniq([layer.outerRadiusKm?.sourceId, layer.innerRadiusKm?.sourceId].filter((id): id is string => id !== undefined)).map((id) => (
              <span key={id}>{cite(id)}</span>
            ))}
            {tag && <span className={tag === 'Estimate' ? 'tag tag--estimate' : 'tag tag--illustrative'}>{tag}</span>}
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
        );
      })}
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
          <Interior bodyId={details.bodyId} layers={interior.layers} cite={cite} />
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
