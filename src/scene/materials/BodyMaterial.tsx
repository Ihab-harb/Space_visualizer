import type { Body } from '../../core/catalog/schema';
import { useViewStore } from '../../state/viewStore';
import { AtmosphereShell } from './AtmosphereShell';
import { CloudShell } from './CloudShell';
import { CoronaGlow } from './CoronaGlow';
import { EarthMaterial } from './EarthMaterial';
import { GiantMaterial } from './GiantMaterial';
import { RockyMaterial } from './RockyMaterial';
import { RingShell } from './RingShell';
import { ringRadii } from './rings';
import { SunMaterial } from './SunMaterial';
import { VenusMaterial } from './VenusMaterial';

/** Chooses the shader for a body from its render settings. */
export function BodyMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  switch (body.render.shader) {
    case 'rocky':
      return <RockyMaterial body={body} bodies={bodies} />;
    case 'earth':
      return <EarthMaterial body={body} bodies={bodies} />;
    case 'giant':
      return <GiantMaterial body={body} bodies={bodies} />;
    case 'venus':
      return <VenusMaterial body={body} bodies={bodies} />;
    case 'sun':
      return <SunMaterial body={body} bodies={bodies} />;
  }
}

/** Child meshes that ride with the body (clouds, atmosphere, rings, corona). */
export function BodyExtras({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const venusRadar = useViewStore((s) => s.venusRadar);
  const hideAtmosphere = body.render.shader === 'venus' && venusRadar && !!body.imagery?.radar;
  return (
    <>
      {body.render.shader === 'earth' && <CloudShell body={body} bodies={bodies} />}
      {body.render.atmosphere && !hideAtmosphere && <AtmosphereShell body={body} bodies={bodies} />}
      {ringRadii(body) && <RingShell body={body} bodies={bodies} />}
      {body.render.shader === 'sun' && <CoronaGlow body={body} bodies={bodies} />}
    </>
  );
}
