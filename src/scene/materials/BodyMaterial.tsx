import { useMemo } from 'react';
import { Color } from 'three';
import type { Body } from '../../core/catalog/schema';
import { AtmosphereShell } from './AtmosphereShell';
import { CloudShell } from './CloudShell';
import { EarthMaterial } from './EarthMaterial';
import { GiantMaterial } from './GiantMaterial';
import { RockyMaterial } from './RockyMaterial';

/** Chooses the shader for a body from its render settings. Shaders not yet implemented fall back to M1 materials. */
export function BodyMaterial({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  const starColor = useMemo(() => new Color(body.display.color).multiplyScalar(2.2), [body.display.color]);
  switch (body.render.shader) {
    case 'rocky':
      return <RockyMaterial body={body} bodies={bodies} />;
    case 'earth':
      return <EarthMaterial body={body} bodies={bodies} />;
    case 'giant':
      return <GiantMaterial body={body} bodies={bodies} />;
    case 'sun':
      return <meshBasicMaterial color={starColor} toneMapped={false} />;
    default:
      return <meshStandardMaterial color={body.display.color} roughness={1} metalness={0} />;
  }
}

/** Child meshes that ride with the body (clouds, atmosphere, rings, corona). */
export function BodyExtras({ body, bodies }: { body: Body; bodies: readonly Body[] }) {
  return (
    <>
      {body.render.shader === 'earth' && <CloudShell body={body} bodies={bodies} />}
      {body.render.atmosphere && <AtmosphereShell body={body} bodies={bodies} />}
    </>
  );
}
