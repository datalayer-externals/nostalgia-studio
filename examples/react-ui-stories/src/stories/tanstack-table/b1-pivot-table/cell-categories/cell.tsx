import React from 'react';

import { ColumnTypes } from '../utils';
import { NumberCell } from './number-cell';
import { SelectCell } from './select-cell';
import { TextCell } from './text-cell';

export function Cell(props) {
  const {
    row: { index },
    column: { id, options },
    dataDispatch,
  } = props;
  console.log(';; cell ', props)

  const initialValue = props.cell.getValue();
  const dataType = props.column.columnDef.dataType;

  function getCellElement() {
    switch (dataType) {
      case ColumnTypes.TEXT:
        return (
          <TextCell
            initialValue={initialValue}
            rowIndex={index}
            columnId={id}
            dataDispatch={dataDispatch}
          />
        );
      case ColumnTypes.NUMBER:
        return (
          <NumberCell
            initialValue={initialValue}
            rowIndex={index}
            columnId={id}
            dataDispatch={dataDispatch}
          />
        );
      // case ColumnTypes.SELECT:
      //   return (
      //     <SelectCell
      //       initialValue={initialValue}
      //       options={options}
      //       rowIndex={index}
      //       columnId={id}
      //       dataDispatch={dataDispatch}
      //     />
      //   );
      default:
        return <span></span>;
    }
  }

  return getCellElement();
}
