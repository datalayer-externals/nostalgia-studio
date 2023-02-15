import { EditorRange, isEqual, TextDocument } from '@typewriter/document';

import type { Editor } from '../editor';
import { EditorChangeEvent } from '../editor-event';
import {
  type Combined,
  combineLines,
  getChangedRanges,
  type HTMLLineElement,
  renderLine,
  setLineNodesRanges,
} from '../rendering/rendering';
import { setSelection } from '../rendering/selection';
import { h, patch, type VNode } from '../rendering/vdom';

/** old and new doc contents needed by virtual render*/
export interface VirtualRenderWhat {
  old?: TextDocument;
  doc?: TextDocument;
  selection: EditorRange | null;
}

type HeightInfo = [marginTop: number, height: number, marginBottom: number];

/**
 * only render minimal editor contents in editor container
 */
export function virtualRendering(editor: Editor) {
  let start = 0;
  let end = 0;
  /** Array<[mt,height,mb]> */
  let heightMap = [] as HeightInfo[];
  let children: HTMLLineElement[] = [];
  let viewportHeight = 0;
  let offsetTop: number;
  /** 不可见元素的默认高度 */
  let averageHeight = 40;
  /** editor lines items */
  let items: Combined;
  let itemsDoc: TextDocument;
  let lastSelection: EditorRange | null = null;
  let lineSelection: EditorRange | null = null; // not doc index but Combined index
  let toRender: number[];
  let hasChanged = false;
  let updateQueued = true;

  /** editor's first scrollable ancestor */
  const containerViewport = getScrollParent(editor.root);
  containerViewport.addEventListener('scroll', onScroll, { passive: true });
  const offResize = onResize(containerViewport, (width, height, changed) => {
    viewportHeight = height;
    if (changed & WIDTH) heightMap = []; // content may be different heights, recalculate everything
    update();
  });

  editor.on('change', onChange);

  /** trigger `update()` */
  function render(what?: VirtualRenderWhat) {
    if (!what || !items) {
      // /first render to dom
      const doc =
        (editor.modules.decorations.doc as TextDocument) || editor.doc;
      items = combineLines(editor, doc.lines).combined;
      itemsDoc = doc;
      hasChanged = true;
      lastSelection = doc.selection;
      update();
    } else {
      // /update existing dom
      const { doc, old } = what;
      const selection = what.selection || null;
      const newSelection =
        selection &&
        selectedLineIndexes(selection, items).sort((a, b) => a - b);

      if (!isEqual(newSelection, lineSelection)) {
        hasChanged = hasChanged || !withinRender(newSelection, true);
        lineSelection = newSelection;
      }

      if (old && doc) {
        const newItems = combineLines(editor, doc.lines).combined;
        const [oldRange, newRange] = getChangedRanges(items, newItems);
        if (oldRange[0] + oldRange[1] + newRange[0] + newRange[1] > 0) {
          hasChanged = true;
          const oldLength = oldRange[1] - oldRange[0];
          const newLength = newRange[1] - newRange[0];
          if (oldLength < newLength) {
            // lines were added, add empty spots into the heightMap
            const empty = new Array(newLength - oldLength).fill(undefined);
            heightMap.splice(oldRange[1], 0, ...empty);
          } else if (oldLength > newLength) {
            heightMap.splice(oldRange[0], oldLength - newLength);
          }
        }

        items = newItems;
        itemsDoc = doc;
      } else if (doc) {
        items = combineLines(editor, doc.lines).combined;
        itemsDoc = doc;
        hasChanged = true;
      }

      lastSelection = selection;
      if (hasChanged) update();
    }
  }

  /** Determine start and end of visible range, and cache rendered lines height */
  function update() {
    updateQueued = false;
    if (!items) return;
    const { scrollTop } = containerViewport;
    offsetTop = getOffsetTop();
    // console.log(';; offsetTop ', offsetTop, scrollTop);

    const oldStart = start;
    const previousHeights = heightMap.slice();
    let didUpdate = false;
    let count = 0; // failsafe

    // use 20 to ensure logic can be finished in 1 frame
    while (shouldUpdate() && count++ < 20) {
      didUpdate = true;
      hasChanged = false;
      renderToDom();
      updateHeights();
    }
    if (count >= 20) console.error('Updated virtual max times');
    // console.log(';; height ', averageHeight, heightMap);

    setSelection(editor, lastSelection);
    if (!didUpdate) return;

    // prevent jumping if we scrolled up into unknown territory
    if (start < oldStart) {
      let expectedHeight = 0;
      let actualHeight = 0;
      const offset = toRender.indexOf(start);

      for (let i = start; i < oldStart; i++) {
        const childIndex = i - start + offset;
        if (children[childIndex]) {
          expectedHeight += getHeightFor(i, previousHeights);
          actualHeight += getHeightFor(i);
        }
      }

      const d = actualHeight - expectedHeight;
      containerViewport.scrollTo(0, scrollTop + d);
    }
  }

  /**
   * calculate minimal items toRender, if changed, return true
   */
  function shouldUpdate() {
    const { scrollTop } = containerViewport;

    /** render candidates blocks/lines */
    const renderSet = new Set([0, items.length - 1, ...(lineSelection || [])]);

    let i = 0;
    let y = offsetTop;
    /** start index to render */
    let newStart = 0;
    /** end index to render */
    let newEnd = 0;

    while (i < items.length) {
      const rowHeight = getHeightFor(i);
      if (y + rowHeight > scrollTop) {
        newStart = i;
        break; // 👈🏻
      }
      y += rowHeight;
      i += 1;
    }

    while (i < items.length) {
      renderSet.add(i);
      y += getHeightFor(i);
      i += 1;
      if (y > scrollTop + viewportHeight) break;
    }

    // Include one extra item at the bottom to make a smoother visual update (should be i - 1)
    newEnd = Math.min(i, items.length - 1);

    const newRender = Array.from(renderSet).sort((a, b) => a - b);

    if (!isEqual(newRender, toRender)) {
      start = newStart;
      end = newEnd;
      toRender = newRender;
      return true;
    }

    return hasChanged;
  }

  /**  render minimal editor lines/blocks content, and insert spacer  */
  function renderToDom() {
    const vNodes: VNode[] = [];

    // Always render the first line, the last line, and the lines with the start/end selection so that deletion and
    // selection commands will work (e.g. selecting from one line to another no in-screen and let Select All work).
    const renderSet = new Set(toRender);
    let spacerKey: string = '';
    let spacerMarginTop = 0;
    let spacerMarginBottom = 0;
    /** total height */
    let total = 0;

    for (let i = 0, space = 0; i < items.length; i++) {
      if (renderSet.has(i)) {
        if (space) {
          spacerMarginBottom = getMarginBetween(i, -1);
          space -= spacerMarginTop;
          const spacer = h('div', {
            class: '-spacer-',
            ['data-key']: spacerKey,
            style: `height:${space}px;margin-top:${spacerMarginTop}px;margin-bottom:${spacerMarginBottom}px;`,
            key: spacerKey,
          });
          spacerKey = '';
          vNodes.push(spacer);
        }
        space = 0;
        // console.log(';; r ', i, items[i]); // single line

        const node = renderLine(editor, items[i]);
        vNodes.push(node);
      } else {
        if (i === 1) spacerKey = 'spacer-start';
        else if (i === items.length - 2) spacerKey = 'spacer-end';
        else if (!spacerKey && lineSelection && i > lineSelection[1])
          spacerKey = 'spacer-selection-end';
        else if (!spacerKey && lineSelection && i > lineSelection[0])
          spacerKey = 'spacer-selection-start';
        if (!space) spacerMarginTop = getMarginBetween(i, -1);
        space += getHeightFor(i);
      }

      total += getHeightFor(i);
    }

    editor.dispatchEvent(new Event('rendering'));
    // 👇🏻 commit to dom
    patch(editor.root, vNodes);
    setLineNodesRanges(editor);
    editor.dispatchEvent(new Event('render'));
    editor.dispatchEvent(new Event('rendered'));
  }

  /**
   * update heightMap and averageHeight
   */
  function updateHeights() {
    children = Array.from(editor.root.children).filter(
      (child) => child.className !== '-spacer-',
    ) as HTMLLineElement[];
    for (let i = 0; i < children.length; i++) {
      const index = toRender[i];
      heightMap[index] = getHeightInfo(children[i]);
    }
    if (!children.length) return;
    const heights = heightMap.filter(Boolean);
    averageHeight = Math.round(
      getMarginBetween(0, -1, heights) +
      heights.reduce((a, b, i, arr) => a + getHeightFor(i, arr), 0) /
      heights.length,
    );
  }

  function getOffsetTop() {
    const { scrollTop } = containerViewport;
    const { root } = editor;
    if (containerViewport === root)
      return parseInt(getComputedStyle(root).paddingTop);
    return (
      root.getBoundingClientRect().top +
      parseInt(getComputedStyle(root).paddingTop) +
      scrollTop -
      containerViewport.getBoundingClientRect().top
    );
  }

  /** 使用`getComputedStyle`计算元素高度 */
  function getHeightInfo(node: HTMLLineElement): HeightInfo {
    const styles = getComputedStyle(node);
    return [
      parseInt(styles.marginTop, 10),
      node.offsetHeight,
      parseInt(styles.marginBottom, 10),
    ];
  }

  /** 使用场景，计算最小更新范围，渲染时计算隐藏区域高度 */
  function getHeightFor(i: number, array = heightMap) {
    if (!array[i]) return averageHeight; // 默认返回 mt+height+mb
    return (
      (i === 0 ? getMarginBetween(i, -1, array) : 0) +
      array[i][1] +
      getMarginBetween(i, 1, array)
    );
  }

  function getMarginBetween(i: number, direction: -1 | 1, array = heightMap) {
    return Math.max(
      (array[i] && array[i][2]) || 0,
      (array[i + direction] && array[i + direction][0]) || 0,
    );
  }

  function withinRender(range: EditorRange | null, inclusive?: boolean) {
    if (!range) return false;
    let [from, to] = range;
    if (inclusive) to++;
    return toRender.some((i) => i >= from && i < to);
  }

  /** exec update() */
  function onScroll() {
    if (updateQueued) return;
    requestAnimationFrame(update);
    updateQueued = true;
  }

  /**
   * trigger `render()` using data from arguments
   */
  function onChange(event: EditorChangeEvent) {
    const { old, doc } =
      (editor.modules.decorations as {
        old: TextDocument;
        doc: TextDocument;
      }) || event;
    const selection = event.doc.selection;
    render({ old, doc, selection });
  }

  return {
    render,
    init() {
      if (editor.modules.decorations) {
        editor.modules.decorations.gatherDecorations();
      }
      render();
    },
    destroy() {
      offResize();
      containerViewport.removeEventListener('scroll', onScroll);
      editor.off('change', onChange);
    },
  };
}

const scrollable = /auto|scroll/;
function getScrollParent(node: HTMLElement) {
  while (node && node !== node.ownerDocument.scrollingElement) {
    // if (scrollable.test(getComputedStyle(node).overflowY)) return node;
    if (['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) {
      return node;
    }
    node = node.parentNode as HTMLElement;
  }
  return node;
}

const WIDTH = 1;
const HEIGHT = 2;
const BOTH = 3;

/** using `ResizeObserver` */
function onResize(
  node: HTMLElement,
  callback: (width: number, height: number, changed: number) => void,
): () => void {
  let width = node.offsetWidth;
  let height = node.offsetHeight;
  callback(width, height, BOTH);

  if (typeof (window as any).ResizeObserver !== 'undefined') {
    const observer = new (window as any).ResizeObserver(onResizeWindow);
    observer.observe(node);
    return () => observer.disconnect();
  } else {
    const window = node.ownerDocument.defaultView as Window;
    window.addEventListener('resize', onResizeWindow);
    return () => window.removeEventListener('resize', onResizeWindow);
  }

  function onResizeWindow() {
    const { offsetWidth, offsetHeight } = node;
    const changed =
      (width !== offsetWidth ? WIDTH : 0) |
      (height !== offsetHeight ? HEIGHT : 0);
    if (changed) {
      width = offsetWidth;
      height = offsetHeight;
      callback(width, height, changed);
    }
  }
}

function selectedLineIndexes(
  [from, to]: EditorRange,
  lines: Combined,
): EditorRange {
  let first: number = 0;
  let last: number = 0;
  for (let i = 0, pos = 0; i < lines.length; i++) {
    const entry = lines[i];
    const length = Array.isArray(entry)
      ? entry.reduce((length, line) => length + line.length, 0)
      : entry.length;
    if (from >= pos && from < pos + length) first = i;
    if (to >= pos && to < pos + length) {
      last = i;
      break;
    }
    pos += length;
  }
  return [first, last];
}
