import { createContext, useContext, type RefObject } from 'react';

/**
 * A fixed DOM container for drei <Html> labels. Without it drei picks its target from R3F's event state,
 * which changes once events connect, tearing down and recreating every label root during a render.
 */
export const LabelLayerContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function useLabelLayer(): RefObject<HTMLDivElement | null> {
  const layer = useContext(LabelLayerContext);
  if (!layer) throw new Error('useLabelLayer must be used inside <LabelLayerContext.Provider>');
  return layer;
}
