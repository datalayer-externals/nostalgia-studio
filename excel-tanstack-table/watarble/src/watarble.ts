import { getDefaultConfig, registerInstance } from './config';
import { MainView } from './main-view';
import { State } from './state';
import { type WatarbleParams } from './types/api';

/**
 * Controller for data model and views
 */
export class Watarble {
  id: string;
  config: any;
  state: State;
  view: MainView;

  constructor(options?: WatarbleParams) {
    this.id = registerInstance(this, options?.id);
    this.config = getDefaultConfig(options);

    this.state = new State({
      ...this.config,
      id: this.id,
      onStateChange: () => {
        this.config.onChange?.();
        this.view.updateView();
      },
    });

    this.view = new MainView({
      ...this.config,
      watarble: this,
    });

    this.init();
  }

  init() {
    this.view.updateView();
    if (this.config.onChange) this.config.onChange();
  }
}
