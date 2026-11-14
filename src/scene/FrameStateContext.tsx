import { createContext, useContext, useState, type ReactNode } from 'react';
import { createFrameState, type FrameState } from './frameState';

const FrameStateContext = createContext<FrameState | null>(null);

export function FrameStateProvider({ children }: { children: ReactNode }) {
  const [frame] = useState(createFrameState);
  return <FrameStateContext.Provider value={frame}>{children}</FrameStateContext.Provider>;
}

export function useFrameState(): FrameState {
  const frame = useContext(FrameStateContext);
  if (!frame) throw new Error('useFrameState must be used inside <FrameStateProvider>');
  return frame;
}
