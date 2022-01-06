import type { NodeSpec, Node as PmNode } from 'prosemirror-model';

// import type { CellAttributes } from '@atlaskit/editor-tables/types';
import {
  B100,
  B50,
  B75,
  G200,
  G50,
  G75,
  N0,
  N20,
  N60,
  N800,
  P100,
  P50,
  P75,
  R100,
  R50,
  R75,
  T100,
  T50,
  T75,
  Y200,
  Y50,
  Y75,
  hexToRgba,
  isRgb,
  rgbToHex,
} from '../../utils/colors';
import { uuid } from '../../utils/uuid';
import type { BlockCardDefinition as BlockCard } from './block-card';
import type { BlockQuoteDefinition as Blockquote } from './blockquote';
import type { BulletListDefinition as BulletList } from './bullet-list';
import type { CodeBlockDefinition as CodeBlock } from './code-block';
import type { DecisionListDefinition as DecisionList } from './decision-list';
import type { EmbedCardDefinition as EmbedCard } from './embed-card';
import type {
  ExtensionDefinition as Extension,
  ExtensionWithMarksDefinition as ExtensionWithMarks,
} from './extension';
import type {
  HeadingDefinition as Heading,
  HeadingWithMarksDefinition as HeadingWithMarks,
} from './heading';
import type { MediaGroupDefinition as MediaGroup } from './media-group';
import type { MediaSingleDefinition as MediaSingle } from './media-single';
import type { NestedExpandDefinition as NestedExpand } from './nested-expand';
import type { OrderedListDefinition as OrderedList } from './ordered-list';
import type { PanelDefinition as Panel } from './panel';
import {
  ParagraphDefinition as Paragraph,
  ParagraphWithAlignmentDefinition as ParagraphWithMarks,
} from './paragraph';
import type { RuleDefinition as Rule } from './rule';
import type { TaskListDefinition as TaskList } from './task-list';

type CellAttributes = any;
export type { CellAttributes };
export const tablePrefixSelector = 'pm-table';

export const tableCellSelector = `${tablePrefixSelector}-cell-content-wrap`;
export const tableHeaderSelector = `${tablePrefixSelector}-header-content-wrap`;
export const tableCellContentWrapperSelector = `${tablePrefixSelector}-cell-nodeview-wrapper`;
export const tableCellContentDomSelector = `${tablePrefixSelector}-cell-nodeview-content-dom`;

const DEFAULT_TABLE_HEADER_CELL_BACKGROUND = N20.toLocaleLowerCase();

const getCellAttrs = (dom: HTMLElement, defaultValues: CellAttributes = {}) => {
  const widthAttr = dom.getAttribute('data-colwidth');
  const width =
    widthAttr && /^\d+(,\d+)*$/.test(widthAttr)
      ? widthAttr.split(',').map((str) => Number(str))
      : null;
  const colspan = Number(dom.getAttribute('colspan') || 1);
  let { backgroundColor } = dom.style;
  if (backgroundColor && isRgb(backgroundColor)) {
    const result = rgbToHex(backgroundColor);
    if (result !== null) {
      backgroundColor = result;
    }
  }

  return {
    colspan,
    rowspan: Number(dom.getAttribute('rowspan') || 1),
    colwidth: width && width.length === colspan ? width : null,
    background:
      backgroundColor && backgroundColor !== defaultValues['background']
        ? backgroundColor
        : null,
  };
};

export type CellDomAttrs = {
  colspan?: string;
  rowspan?: string;
  style?: string;
  colorname?: string;
  'data-colwidth'?: string;
  class?: string;
};

export const setCellAttrs = (node: PmNode, cell?: HTMLElement) => {
  const attrs: CellDomAttrs = {};
  const nodeType = node.type.name;
  const colspan = cell ? parseInt(cell.getAttribute('colspan') || '1', 10) : 1;
  const rowspan = cell ? parseInt(cell.getAttribute('rowspan') || '1', 10) : 1;

  if (node.attrs.colspan !== colspan) {
    attrs.colspan = node.attrs.colspan;
  }
  if (node.attrs.rowspan !== rowspan) {
    attrs.rowspan = node.attrs.rowspan;
  }

  if (node.attrs.colwidth) {
    attrs['data-colwidth'] = node.attrs.colwidth.join(',');
  }
  if (node.attrs.background) {
    const { background } = node.attrs;

    // to ensure that we don't overwrite product's style:
    // - it clears background color for <th> if its set to gray
    // - it clears background color for <td> if its set to white
    const ignored =
      (nodeType === 'tableHeader' &&
        background === tableBackgroundColorNames.get('light gray')) ||
      (nodeType === 'tableCell' &&
        background === tableBackgroundColorNames.get('white'));

    if (ignored) {
      attrs.style = '';
    } else {
      const color = isRgb(background) ? rgbToHex(background) : background;

      attrs.style = `${attrs.style || ''}background-color: ${color};`;
      attrs.colorname = tableBackgroundColorPalette.get(color);
    }
  }

  if (nodeType === 'tableHeader') {
    attrs.class = tableHeaderSelector;
  } else {
    attrs.class = tableCellSelector;
  }

  return attrs;
};

export const tableBackgroundColorPalette = new Map<string, string>();

export const tableBackgroundBorderColor = hexToRgba(N800, 0.12) || N0;
export const tableBackgroundColorNames = new Map<string, string>();

[
  [N0, 'White'],
  [B50, 'Light blue'],
  [T50, 'Light teal'],
  [G50, 'Light green'],
  [Y50, 'Light yellow'],
  [R50, 'Light red'],
  [P50, 'Light purple'],

  [N20, 'Light gray'],
  [B75, 'Blue'],
  [T75, 'Teal'],
  [G75, 'Green'],
  [Y75, 'Yellow'],
  [R75, 'Red'],
  [P75, 'Purple'],

  [N60, 'Gray'],
  [B100, 'Dark blue'],
  [T100, 'Dark teal'],
  [G200, 'Dark green'],
  [Y200, 'Dark yellow'],
  [R100, 'Dark red'],
  [P100, 'Dark purple'],
].forEach(([colorValue, colorName]) => {
  tableBackgroundColorPalette.set(colorValue.toLowerCase(), colorName);
  tableBackgroundColorNames.set(
    colorName.toLowerCase(),
    colorValue.toLowerCase(),
  );
});

export type Layout = 'default' | 'full-width' | 'wide';

export interface TableAttributes {
  isNumberColumnEnabled?: boolean;
  layout?: Layout;
  __autoSize?: boolean;
  /**
   * @stage 0
   * @minLength 1
   */
  localId?: string;
}

/**
 * @name table_node
 */
export interface TableDefinition {
  type: 'table';
  attrs?: TableAttributes;
  /**
   * @minItems 1
   */
  content: Array<TableRow>;
}

/**
 * @name table_row_node
 */
export interface TableRow {
  type: 'tableRow';
  content: Array<TableHeader | TableCell>;
}

/**
 * @name table_cell_content
 * @minItems 1
 * @allowUnsupportedBlock true
 */
export type TableCellContent = Array<
  | Panel
  | Paragraph
  | ParagraphWithMarks
  | Blockquote
  | OrderedList
  | BulletList
  | Rule
  | Heading
  | HeadingWithMarks
  | CodeBlock
  | MediaGroup
  | MediaSingle
  | DecisionList
  | TaskList
  | Extension
  | ExtensionWithMarks
  | BlockCard
  | NestedExpand
  | EmbedCard
>;

/**
 * @name table_cell_node
 */
export interface TableCell {
  type: 'tableCell';
  attrs?: CellAttributes;
  content: TableCellContent;
}

/**
 * @name table_header_node
 */
export interface TableHeader {
  type: 'tableHeader';
  attrs?: CellAttributes;
  content: TableCellContent;
}

// TODO: Fix any, potential issue. ED-5048
const createTableSpec = (allowLocalId: boolean = false): NodeSpec => {
  const attrs = {
    isNumberColumnEnabled: { default: false },
    layout: { default: 'default' },
    __autoSize: { default: false },
  };
  const finalAttrs = allowLocalId
    ? {
        ...attrs,
        localId: { default: '' },
      }
    : attrs;
  const tableNodeSpec: NodeSpec = {
    content: 'tableRow+',
    attrs: finalAttrs,
    marks: 'unsupportedMark unsupportedNodeAttribute',
    tableRole: 'table',
    isolating: true,
    selectable: false,
    group: 'block',
    parseDOM: [
      {
        tag: 'table',
        getAttrs: (node: string | Node) => {
          const dom = node as HTMLElement;
          const breakoutWrapper = dom.parentElement?.parentElement;

          const localIdAttr = allowLocalId
            ? {
                localId:
                  dom.getAttribute('data-table-local-id') || uuid.generate(),
              }
            : {};

          return {
            isNumberColumnEnabled:
              dom.getAttribute('data-number-column') === 'true' ? true : false,
            layout:
              // copying from editor
              dom.getAttribute('data-layout') ||
              // copying from renderer
              breakoutWrapper?.getAttribute('data-layout') ||
              'default',
            __autoSize:
              dom.getAttribute('data-autosize') === 'true' ? true : false,
            ...localIdAttr,
          };
        },
      },
    ],
    toDOM(node: PmNode) {
      const localIdAttr = allowLocalId
        ? { 'data-table-local-id': node.attrs.localId }
        : {};
      const attrs = {
        'data-number-column': node.attrs.isNumberColumnEnabled,
        'data-layout': node.attrs.layout,
        'data-autosize': node.attrs.__autoSize,
        ...localIdAttr,
      };
      return ['table', attrs, ['tbody', 0]];
    },
  };
  return tableNodeSpec;
};

export const table = createTableSpec(false);
export const tableWithLocalId = createTableSpec(true);

export const tableToJSON = (node: PmNode) => ({
  attrs: Object.keys(node.attrs)
    .filter((key) => !key.startsWith('__'))
    .reduce<typeof node.attrs>((obj, key) => {
      obj[key] = node.attrs[key];
      return obj;
    }, {}),
});

export const tableRow: NodeSpec = {
  selectable: false,
  content: '(tableCell | tableHeader)+',
  marks: 'unsupportedMark unsupportedNodeAttribute',
  tableRole: 'row',
  parseDOM: [{ tag: 'tr' }],
  toDOM() {
    return ['tr', 0];
  },
};

const cellAttrs = {
  colspan: { default: 1 },
  rowspan: { default: 1 },
  colwidth: { default: null },
  background: { default: null },
};

export const tableCell: NodeSpec = {
  selectable: false,
  content:
    '(paragraph | panel | blockquote | orderedList | bulletList | rule | heading | codeBlock | mediaSingle |  mediaGroup | decisionList | taskList | blockCard | embedCard | extension | nestedExpand | unsupportedBlock)+',
  attrs: cellAttrs,
  tableRole: 'cell',
  marks: 'link alignment dataConsumer unsupportedMark unsupportedNodeAttribute',
  isolating: true,
  parseDOM: [
    // Ignore number cell copied from renderer
    {
      tag: '.ak-renderer-table-number-column',
      ignore: true,
    },
    {
      tag: 'td',
      getAttrs: (dom: string | Node) => getCellAttrs(dom as HTMLElement),
    },
  ],
  toDOM: (node: PmNode) => ['td', setCellAttrs(node), 0],
};

export const toJSONTableCell = (node: PmNode) => ({
  attrs: (Object.keys(node.attrs) as Array<keyof CellAttributes>).reduce<
    Record<string, any>
  >((obj, key: any) => {
    if (cellAttrs[key].default !== node.attrs[key]) {
      obj[key] = node.attrs[key];
    }

    return obj;
  }, {}),
});

export const tableHeader: NodeSpec = {
  selectable: false,
  content:
    '(paragraph | panel | blockquote | orderedList | bulletList | rule | heading | codeBlock | mediaSingle |  mediaGroup | decisionList | taskList | blockCard | embedCard | extension | nestedExpand)+',
  attrs: cellAttrs,
  tableRole: 'header_cell',
  isolating: true,
  marks: 'link alignment dataConsumer unsupportedMark unsupportedNodeAttribute',
  parseDOM: [
    {
      tag: 'th',
      getAttrs: (dom: string | Node) =>
        getCellAttrs(dom as HTMLElement, {
          background: DEFAULT_TABLE_HEADER_CELL_BACKGROUND,
        }),
    },
  ],

  toDOM: (node: PmNode) => ['th', setCellAttrs(node), 0],
};

export const toJSONTableHeader = toJSONTableCell;
