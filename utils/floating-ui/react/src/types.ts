import type * as React from 'react';

import {
  type ComputePositionReturn,
  type Middleware,
  type Placement,
  type Platform,
  type Strategy,
  type UseFloatingReturn as UsePositionFloatingReturn,
  type VirtualElement,
} from '@floating-ui/react-dom';

import { type DismissPayload } from './hooks/useDismiss';

export * from '.';
export { type Props as FloatingArrowProps } from './components/FloatingArrow';
export { type Props as UseClickProps } from './hooks/useClick';
export { type Props as UseClientPointProps } from './hooks/useClientPoint';
export { type Props as UseDismissProps } from './hooks/useDismiss';
export { type Props as UseFocusProps } from './hooks/useFocus';
export { type Props as UseHoverProps } from './hooks/useHover';
export { type Props as UseListNavigationProps } from './hooks/useListNavigation';
export { type Props as UseRoleProps } from './hooks/useRole';
export {
  type Props as UseTransitionStatusProps,
  type UseTransitionStylesProps,
} from './hooks/useTransition';
export { type Props as UseTypeaheadProps } from './hooks/useTypeahead';
export { type InnerProps, type UseInnerOffsetProps } from './inner';
export type {
  AlignedPlacement,
  Alignment,
  ArrowOptions,
  AutoPlacementOptions,
  AutoUpdateOptions,
  Axis,
  Boundary,
  ClientRectObject,
  ComputePositionConfig,
  ComputePositionReturn,
  Coords,
  DetectOverflowOptions,
  Dimensions,
  ElementContext,
  ElementRects,
  Elements,
  FlipOptions,
  FloatingElement,
  HideOptions,
  InlineOptions,
  Length,
  Middleware,
  MiddlewareArguments,
  MiddlewareData,
  MiddlewareReturn,
  MiddlewareState,
  NodeScroll,
  OffsetOptions,
  Padding,
  Placement,
  Platform,
  Rect,
  ReferenceElement,
  RootBoundary,
  ShiftOptions,
  Side,
  SideObject,
  SizeOptions,
  Strategy,
  VirtualElement,
} from '@floating-ui/react-dom';
export {
  arrow,
  autoPlacement,
  autoUpdate,
  computePosition,
  detectOverflow,
  flip,
  getOverflowAncestors,
  hide,
  inline,
  limitShift,
  offset,
  platform,
  shift,
  size,
} from '@floating-ui/react-dom';

type Prettify<T> = {
  [K in keyof T]: T[K];
  // eslint-disable-next-line @typescript-eslint/ban-types
} & {};

export type NarrowedElement<T> = T extends Element ? T : Element;

export interface ExtendedRefs<RT> {
  reference: React.MutableRefObject<ReferenceType | null>;
  floating: React.MutableRefObject<HTMLElement | null>;
  domReference: React.MutableRefObject<NarrowedElement<RT> | null>;
  setReference: (node: RT | null) => void;
  setFloating: (node: HTMLElement | null) => void;
  setPositionReference: (node: ReferenceType | null) => void;
}

export interface ExtendedElements<RT> {
  reference: ReferenceType | null;
  floating: HTMLElement | null;
  domReference: NarrowedElement<RT> | null;
}

export interface FloatingEvents {
  emit<T extends string>(
    event: T,
    data?: T extends 'dismiss' ? DismissPayload : any,
  ): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}

export interface ContextData {
  openEvent?: MouseEvent | PointerEvent | FocusEvent;
  /** @deprecated use `onTypingChange` prop in `useTypeahead` */
  typing?: boolean;
  [key: string]: any;
}

export type FloatingContext<RT extends ReferenceType = ReferenceType> =
  Prettify<
    Omit<UsePositionFloatingReturn<RT>, 'refs' | 'elements'> & {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      events: FloatingEvents;
      dataRef: React.MutableRefObject<ContextData>;
      nodeId: string | undefined;
      floatingId: string;
      refs: ExtendedRefs<RT>;
      elements: ExtendedElements<RT>;
    }
  >;

export interface FloatingNodeType<RT extends ReferenceType = ReferenceType> {
  id: string;
  parentId: string | null;
  context?: FloatingContext<RT>;
}

export interface FloatingTreeType<RT extends ReferenceType = ReferenceType> {
  nodesRef: React.MutableRefObject<Array<FloatingNodeType<RT>>>;
  events: FloatingEvents;
  addNode: (node: FloatingNodeType) => void;
  removeNode: (node: FloatingNodeType) => void;
}

export interface ElementProps {
  reference?: React.HTMLProps<Element>;
  floating?: React.HTMLProps<HTMLElement>;
  item?: React.HTMLProps<HTMLElement>;
}

export type ReferenceType = Element | VirtualElement;

export type UseFloatingData = Prettify<
  Omit<ComputePositionReturn, 'x' | 'y'> & {
    x: number | null;
    y: number | null;
  }
>;

export type UseFloatingReturn<RT extends ReferenceType = ReferenceType> =
  Prettify<
    UseFloatingData & {
      update: () => void;
      /**
       * @deprecated use `refs.setReference` instead.
       */
      reference: (node: RT | null) => void;
      /**
       * @deprecated use `refs.setFloating` instead.
       */
      floating: (node: HTMLElement | null) => void;
      /**
       * @deprecated use `refs.setPositionReference` instead.
       */
      positionReference: (node: ReferenceType | null) => void;
      context: FloatingContext<RT>;
      refs: ExtendedRefs<RT>;
      elements: ExtendedElements<RT>;
      isPositioned: boolean;
    }
  >;

export interface UseFloatingProps<RT extends ReferenceType = ReferenceType> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement: Placement;
  middleware: Array<Middleware | null | undefined | false>;
  strategy: Strategy;
  platform: Platform;
  nodeId: string;
  whileElementsMounted?: (
    reference: RT,
    floating: HTMLElement,
    update: () => void,
  ) => void | (() => void);
}
