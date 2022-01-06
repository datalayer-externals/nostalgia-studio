import { isRetina } from './isRetina';
import { CardDimensions } from '..';
import { ElementDimension, getElementDimension } from './getElementDimension';
import { defaultImageCardDimensions } from './cardDimensions';
import { isValidPercentageUnit } from './isValidPercentageUnit';
import { containsPixelUnit } from './containsPixelUnit';

export type getDataURIDimensionOptions = {
  element?: Element | null;
  dimensions?: CardDimensions;
};

export const getDataURIDimension = (
  dimension: ElementDimension,
  options: getDataURIDimensionOptions,
): number => {
  const retinaFactor = isRetina() ? 2 : 1;
  const dimensionValue =
    (options.dimensions && options.dimensions[dimension]) || '';

  if (isValidPercentageUnit(dimensionValue) && options.element) {
    return getElementDimension(options.element, dimension) * retinaFactor;
  }

  if (typeof dimensionValue === 'number') {
    return dimensionValue * retinaFactor;
  }

  if (containsPixelUnit(`${dimensionValue}`)) {
    return parseInt(`${dimensionValue}`, 10) * retinaFactor;
  }

  return defaultImageCardDimensions[dimension] * retinaFactor;
};
