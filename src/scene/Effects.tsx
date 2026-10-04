import { Bloom, EffectComposer } from '@react-three/postprocessing';

export function Effects() {
  return (
    <EffectComposer>
      <Bloom mipmapBlur luminanceThreshold={1} intensity={1.1} />
    </EffectComposer>
  );
}
