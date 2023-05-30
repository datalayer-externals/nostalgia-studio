import Codec from '../serialization/Codec';
import { type StyleValue } from '../types';
import type Cell from '../view/cell/Cell';
import { TemporaryCellStates } from '../view/cell/TemporaryCellStates';
import Point from '../view/geometry/Point';
import { type Graph } from '../view/Graph';
import { DIALECT, NODETYPE, NS_SVG } from './Constants';
import { getTextContent } from './domUtils';
import { htmlEntities, trim } from './StringUtils';

/**
 * Returns a new, empty XML document.
 */
export const createXmlDocument = () => {
  return document.implementation.createDocument('', '', null);
};

export const parseXml = (xmlString: string): Document => {
  return new DOMParser().parseFromString(xmlString, 'text/xml');
};

export const getViewXml = (
  graph: Graph,
  scale = 1,
  cells: Cell[] | null = null,
  x0 = 0,
  y0 = 0,
) => {
  if (cells == null) {
    const model = graph.getDataModel();
    cells = [<Cell>model.getRoot()];
  }

  const view = graph.getView();
  let result = null;

  // Disables events on the view
  const eventsEnabled = view.isEventsEnabled();
  view.setEventsEnabled(false);

  // Workaround for label bounds not taken into account for image export.
  // Creates a temporary draw pane which is used for rendering the text.
  // Text rendering is required for finding the bounds of the labels.
  const { drawPane } = view;
  const { overlayPane } = view;

  if (graph.dialect === DIALECT.SVG) {
    view.drawPane = document.createElementNS(NS_SVG, 'g');
    view.canvas.appendChild(view.drawPane);

    // Redirects cell overlays into temporary container
    view.overlayPane = document.createElementNS(NS_SVG, 'g');
    view.canvas.appendChild(view.overlayPane);
  } else {
    view.drawPane = <SVGElement>view.drawPane.cloneNode(false);
    view.canvas.appendChild(view.drawPane);

    // Redirects cell overlays into temporary container
    view.overlayPane = <SVGElement>view.overlayPane.cloneNode(false);
    view.canvas.appendChild(view.overlayPane);
  }

  // Resets the translation
  const translate = view.getTranslate();
  view.translate = new Point(x0, y0);

  // Creates the temporary cell states in the view
  const temp = new TemporaryCellStates(graph.getView(), scale, cells);

  try {
    const enc = new Codec();
    result = enc.encode(graph.getView());
  } finally {
    temp.destroy();
    view.translate = translate;
    view.canvas.removeChild(view.drawPane);
    view.canvas.removeChild(view.overlayPane);
    view.drawPane = drawPane;
    view.overlayPane = overlayPane;
    view.setEventsEnabled(eventsEnabled);
  }
  return result;
};

/**
 * Returns the XML content of the specified node. For Internet Explorer,
 * all \r\n\t[\t]* are removed from the XML string and the remaining \r\n
 * are replaced by \n. All \n are then replaced with linefeed, or &#xa; if
 * no linefeed is defined.
 *
 * @param node DOM node to return the XML for.
 * @param linefeed Optional string that linefeeds are converted into. Default is
 * &#xa;
 */
export const getXml = (node: Element, linefeed = '&#xa;'): string => {
  const xmlSerializer = new XMLSerializer();
  let xml = xmlSerializer.serializeToString(node);

  // Replaces linefeeds with HTML Entities.
  linefeed = linefeed || '&#xa;';
  xml = xml.replace(/\n/g, linefeed);
  return xml;
};

/**
 * Returns a pretty printed string that represents the XML tree for the
 * given node. This method should only be used to print XML for reading,
 * use <getXml> instead to obtain a string for processing.
 *
 * @param node DOM node to return the XML for.
 * @param tab Optional string that specifies the indentation for one level.
 * @param indent Optional string that represents the current indentation.
 * @param newline Optional string that represents a linefeed.
 * @param ns Optional string that represents the target namespace URI.
 */
export const getPrettyXml = (
  node: Element | null,
  tab = '  ',
  indent = '',
  newline = '\n',
  ns: string | null = null,
): string => {
  const result = [];

  if (node != null) {
    if (node.namespaceURI != null && node.namespaceURI !== ns) {
      ns = node.namespaceURI;

      if (node.getAttribute('xmlns') == null) {
        node.setAttribute('xmlns', node.namespaceURI);
      }
    }

    if (node.nodeType === NODETYPE.DOCUMENT) {
      result.push(
        getPrettyXml(
          (<Document>(<unknown>node)).documentElement,
          tab,
          indent,
          newline,
          ns,
        ),
      );
    } else if (node.nodeType === NODETYPE.DOCUMENT_FRAGMENT) {
      let tmp = node.firstChild;

      if (tmp != null) {
        while (tmp != null) {
          result.push(getPrettyXml(<Element>tmp, tab, indent, newline, ns));
          tmp = tmp.nextSibling;
        }
      }
    } else if (node.nodeType === NODETYPE.COMMENT) {
      const value = getTextContent(<Text>(<unknown>node));

      if (value.length > 0) {
        result.push(`${indent}<!--${value}-->${newline}`);
      }
    } else if (node.nodeType === NODETYPE.TEXT) {
      const value = trim(getTextContent(<Text>(<unknown>node)));

      if (value && value.length > 0) {
        result.push(indent + htmlEntities(value, false) + newline);
      }
    } else if (node.nodeType === NODETYPE.CDATA) {
      const value = getTextContent(<Text>(<unknown>node));

      if (value.length > 0) {
        result.push(`${indent}<![CDATA[${value}]]${newline}`);
      }
    } else {
      result.push(`${indent}<${node.nodeName}`);

      // Creates the string with the node attributes
      // and converts all HTML entities in the values
      const attrs = node.attributes;

      if (attrs != null) {
        for (let i = 0; i < attrs.length; i += 1) {
          const val = htmlEntities(attrs[i].value);
          result.push(` ${attrs[i].nodeName}="${val}"`);
        }
      }

      // Recursively creates the XML string for each child
      // node and appends it here with an indentation
      let tmp = node.firstChild;

      if (tmp != null) {
        result.push(`>${newline}`);

        while (tmp != null) {
          result.push(
            getPrettyXml(<Element>tmp, tab, indent + tab, newline, ns),
          );
          tmp = tmp.nextSibling;
        }

        result.push(`${indent}</${node.nodeName}>${newline}`);
      } else {
        result.push(` />${newline}`);
      }
    }
  }
  return result.join('');
};

/**
 * Returns the first node where attr equals value.
 * This implementation does not use XPath.
 */
export const findNode = (
  node: Element,
  attr: string,
  value: StyleValue,
): Element | null => {
  if (node.nodeType === NODETYPE.ELEMENT) {
    const tmp = node.getAttribute(attr);
    if (tmp && tmp === value) {
      return node;
    }
  }

  node = node.firstChild as Element;

  while (node) {
    const result = findNode(node, attr, value);
    if (result) {
      return result;
    }
    node = node.nextSibling as Element;
  }

  return null;
};
