import { FieldValueBase } from './field-value.base.js';
import type { IFieldValueVisitor } from './field-value.visitor.js';
import type { IStringFieldValue } from './string-field.type.js';

export class StringFieldValue extends FieldValueBase<IStringFieldValue> {
  constructor(value: IStringFieldValue) {
    super({ value });
  }

  accept(visitor: IFieldValueVisitor): void {
    visitor.string(this);
  }
}
