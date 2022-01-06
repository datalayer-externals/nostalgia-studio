import React, { useEffect, useReducer, useState } from 'react';

import { useEditorContext } from '../../core/EditorContext';

/**
 * Component to render the mounted nodeViews as portals.
 *
 * This allows them to share React context and it is a lot faster than using plain old ReactDOM.render
 * and unmountComponentAtNode. Previously I had a performance bottleneck with creating multiple nodeviews
 * at once with every update causing this PortalRenderer to re-render. Collecting those operations and running
 * a single flush function per updateState fixed this problem to large extent. This is, as far as I know, still
 * a problem in the original Atlassian editor so maybe they'll notice the same thing some day too.
 *
 * I discuss this here:
 * https://discuss.prosemirror.net/t/a-modified-version-of-atlassians-react-typescript-pm-editor/3441
 */
export function PortalRenderer() {
  const { portalProvider } = useEditorContext();
  const [_, forceUpdate] = useReducer((x) => x + 1, 0);
  const [portals, setPortals] = useState<Map<HTMLElement, React.ReactPortal>>(
    new Map(),
  );

  useEffect(() => {
    // 将更新的方法暴露出去
    portalProvider.addPortalRendererCallback(onUpdatePortals);
  }, [portalProvider]);

  /** 执行强制rerender这个PortalRenderer组件，也就是更新所有ReactNodeViews组件 */
  const onUpdatePortals = (newPortals: Map<HTMLElement, React.ReactPortal>) => {
    setPortals(newPortals);
    forceUpdate();
  };

  return (
    <>{Array.from(portals.entries()).map(([container, portal]) => portal)}</>
  );
}
