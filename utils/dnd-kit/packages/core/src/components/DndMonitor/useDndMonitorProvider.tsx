import { useCallback, useState } from 'react';

import type { DndMonitorEvent, DndMonitorListener } from './types';

/** simple event-emitter */
export function useDndMonitorProvider() {
  const [listeners] = useState(() => new Set<DndMonitorListener>());

  const registerListener = useCallback(
    (listener: DndMonitorListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    [listeners],
  );

  const dispatch = useCallback(
    ({ type, event }: DndMonitorEvent) => {
      listeners.forEach((listener) => listener[type]?.(event as any));
    },
    [listeners],
  );

  return [dispatch, registerListener] as const;
}
