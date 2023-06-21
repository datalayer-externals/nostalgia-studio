import { type StateObserver } from '../state/state-observer';
import { type Command, type CommandDispatcher, type Getters } from '../types';
import { BasePlugin } from './plugin-base';

export interface UiPluginConfig {
  readonly getters: Getters;
  readonly stateObserver: StateObserver;
  readonly dispatch: CommandDispatcher['dispatch'];
  readonly custom: { [key: string]: any };
  readonly selection: any;
  // readonly selection: SelectionStreamProcessor;
  // readonly uiActions: UIActions;
  // readonly session: Session;
}

export interface UiPluginConstructor {
  new (config: UiPluginConfig): UiPlugin;
  getters: readonly string[];
  // layers: LAYERS[];
}

/**
 * plugins handling transient data, useful for ui state
 */
export class UiPlugin<State = any, C = Command> extends BasePlugin<State, C> {
  // static layers: LAYERS[] = [];

  getters: Getters;
  // protected ui: UIActions;
  protected selection: any;
  constructor({ getters, stateObserver, dispatch, selection }: UiPluginConfig) {
    super(stateObserver, dispatch);
    this.getters = getters;
    this.selection = selection;
    // this.ui = uiActions;

    if (!new.target.pluginKey) {
      throw new Error(
        'pluginKey static property is required for ' + new.target.name,
      );
    }
  }

  view(ctx: RenderingContext) {}
}
