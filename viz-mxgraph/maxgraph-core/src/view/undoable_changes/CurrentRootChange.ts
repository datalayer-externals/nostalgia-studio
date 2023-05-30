import { type UndoableChange } from '../../types';
import { type Cell } from '../cell/Cell';
import EventObject from '../event/EventObject';
import InternalEvent from '../event/InternalEvent';
import Point from '../geometry/Point';
import { type Graph } from '../Graph';
import { type GraphView } from '../GraphView';

/**
 * Action to change the current root in a view.
 */
export class CurrentRootChange implements UndoableChange {
  view: GraphView;
  root: Cell | null;
  previous: Cell | null;
  isUp: boolean;

  constructor(view: GraphView, root: Cell | null) {
    this.view = view;
    this.root = root;
    this.previous = root;
    this.isUp = root === null;

    if (!this.isUp) {
      let tmp = this.view.currentRoot;

      while (tmp) {
        if (tmp === root) {
          this.isUp = true;
          break;
        }
        tmp = tmp.getParent();
      }
    }
  }

  /**
   * Changes the current root of the view.
   */
  execute() {
    const tmp = this.view.currentRoot;
    this.view.currentRoot = this.previous;
    this.previous = tmp;

    const translate = (<Graph>this.view.graph).getTranslateForRoot(
      this.view.currentRoot,
    );

    if (translate) {
      this.view.translate = new Point(-translate.x, -translate.y);
    }

    if (this.isUp) {
      this.view.clear(this.view.currentRoot, true, true);
      this.view.validate(null);
    } else {
      this.view.refresh();
    }

    const name = this.isUp ? InternalEvent.UP : InternalEvent.DOWN;

    this.view.fireEvent(
      new EventObject(name, {
        root: this.view.currentRoot,
        previous: this.previous,
      }),
    );

    this.isUp = !this.isUp;
  }
}

export default CurrentRootChange;
