import { unzip } from 'lodash-es';
import { z } from 'zod';
import type { ICollaboratorFilter } from '../filter/collaborator.filter.js';
import type { ICollaboratorFilterOperator } from '../filter/operators.js';
import type { IRecordDisplayValues } from '../record/record.type.js';
import { CollaboratorFieldValue } from './collaborator-field-value.js';
import type {
  CollaboratorFieldType,
  ICreateCollaboratorFieldInput,
  ICreateCollaboratorFieldValue,
  IUpdateCollaboratorFieldInput,
} from './collaborator-field.type.js';
import { BaseField } from './field.base.js';
import type { ICollaboratorField } from './field.type.js';
import type { IFieldVisitor } from './field.visitor.js';

export class CollaboratorField extends BaseField<ICollaboratorField> {
  type: CollaboratorFieldType = 'collaborator';

  get multiple() {
    return true;
  }

  // https://github.com/undb-xyz/undb/issues/781
  override get filterable(): boolean {
    return false;
  }

  override get sortable(): boolean {
    return false;
  }

  static create(
    input: Omit<ICreateCollaboratorFieldInput, 'type'>,
  ): CollaboratorField {
    return new CollaboratorField({
      ...super.createBase(input),
    });
  }

  static unsafeCreate(input: ICreateCollaboratorFieldInput): CollaboratorField {
    return new CollaboratorField({
      ...super.unsafeCreateBase(input),
    });
  }

  public override update(input: IUpdateCollaboratorFieldInput) {
    return this.updateBase(input);
  }

  createValue(value: ICreateCollaboratorFieldValue): CollaboratorFieldValue {
    return new CollaboratorFieldValue(value);
  }

  createFilter(
    operator: ICollaboratorFilterOperator,
    value: null,
  ): ICollaboratorFilter {
    return { operator, value, path: this.id.value, type: 'collaborator' };
  }

  accept(visitor: IFieldVisitor): void {
    visitor.collaborator(this);
  }

  getDisplayValues(values?: IRecordDisplayValues): (string | null)[][] {
    return unzip([
      values?.[this.id.value]?.username ?? [],
      values?.[this.id.value]?.avatar ?? [],
    ]);
  }

  get valueSchema() {
    return this.required ? z.string().array() : z.string().array().nullable();
  }
}
