import { type Mark, Node, type Schema } from 'prosemirror-model';

import { type Plugin, type StateField } from './plugin';
import { Selection, type TextSelection } from './selection';
import { Transaction } from './transaction';

function bind<T extends Function>(f: T, self: any): T {
  return !self || !f ? f : f.bind(self);
}

/** simple fn.bind() */
class FieldDesc<T> {
  /** 插件初始化时候的回调函数，called in EditorState.create。
   * - 这个config对象就是从传给EditorState.create做参数的那个对象扩展出来的，出了包含最初传入EditorState.create的那些属性以外，还包括所有插件（包括内置的插件）。
   * - 也就是说所有插件看到的是一样的config，这个config对象包含了所以其他插件。
   */
  init: (config: EditorStateConfig, instance: EditorState) => T;

  /** 表明这个插件如何影响事务过程（编辑操作是以事务的方式提交的） */
  apply: (
    tr: Transaction,
    value: T,
    oldState: EditorState,
    newState: EditorState,
  ) => T;

  constructor(
    /** pluginKey */
    readonly name: string,
    /** plugin.state */
    desc: StateField<any>,
    /** plugin object */
    self?: any,
  ) {
    this.init = bind(desc.init, self);
    this.apply = bind(desc.apply, self);
  }
}

/** 4 default state fields, doc/sel/marks/scrollToSel  */
const baseFields = [
  new FieldDesc<Node>('doc', {
    init(config) {
      return config.doc || config.schema!.topNodeType.createAndFill();
    },
    apply(tr) {
      return tr.doc;
    },
  }),

  new FieldDesc<Selection>('selection', {
    init(config, instance) {
      return config.selection || Selection.atStart(instance.doc);
    },
    apply(tr) {
      return tr.selection;
    },
  }),

  new FieldDesc<readonly Mark[] | null>('storedMarks', {
    init(config) {
      return config.storedMarks || null;
    },
    apply(tr, _marks, _old, state) {
      return (state.selection as TextSelection).$cursor ? tr.storedMarks : null;
    },
  }),

  new FieldDesc<number>('scrollToSelection', {
    init() {
      return 0;
    },
    apply(tr, prev) {
      return tr.scrolledIntoView ? prev + 1 : prev;
    },
  }),
];

/** Object wrapping the part of state object that stays the same across transactions.
 * Stored in the state's `config` property.
 */
class Configuration {
  /** collections of `plugin.state.init/apply` */
  fields: FieldDesc<any>[];
  plugins: Plugin[] = [];
  pluginsByKey: { [key: string]: Plugin } = Object.create(null);

  constructor(
    readonly schema: Schema,
    plugins?: readonly Plugin[],
  ) {
    this.fields = baseFields.slice();
    if (plugins)
      plugins.forEach((plugin) => {
        if (this.pluginsByKey[plugin.key])
          throw new RangeError(
            'Adding different instances of a keyed plugin (' + plugin.key + ')',
          );
        this.plugins.push(plugin);
        this.pluginsByKey[plugin.key] = plugin;
        if (plugin.spec.state)
          this.fields.push(
            new FieldDesc<any>(plugin.key, plugin.spec.state, plugin),
          );
      });
  }
}

/** The type of object passed to [`EditorState.create`](#state.EditorState^create).
 */
export interface EditorStateConfig {
  /** The schema to use (only relevant if no `doc` is specified). */
  schema?: Schema;
  /** The starting document. Either this or `schema` _must_ be provided. */
  doc?: Node;
  /** A valid selection in the document. */
  selection?: Selection;
  /** The initial set of [stored marks](#state.EditorState.storedMarks). */
  storedMarks?: readonly Mark[] | null;
  /** The plugins that should be active in this state. */
  plugins?: readonly Plugin[];
}

/** The state of a ProseMirror editor is represented by an object of this type.
 * A state is a persistent data structure—it isn't updated, but rather a new
 * state value is computed from an old one using the [`apply`](#state.EditorState.apply) method.
 * - 编辑器状态主要包括：doc内容、selection、storedMarks、config(包括plugins/fields)
 * - pm-state状态是immutable的设计，不要用new创建，使用静态方法如create
 *
 * A state holds a number of built-in fields, and plugins can
 * [define](#state.PluginSpec.state) additional fields.
 */
export class EditorState {
  /** @internal pm-state状态是immutable的设计，不要用new创建，使用静态方法如create */
  constructor(
    /// @internal
    readonly config: Configuration,
  ) {}

  /** The current document. */
  doc!: Node;

  /** The selection. */
  selection!: Selection;

  /** A set of marks to apply to the next input. Will be null when
   * no explicit marks have been set.
   */
  storedMarks!: readonly Mark[] | null;

  /** The schema of the state's document. */
  get schema(): Schema {
    return this.config.schema;
  }

  /** The plugins that are active in this state. */
  get plugins(): readonly Plugin[] {
    return this.config.plugins;
  }

  /** Start a [transaction](#state.Transaction) from this state.
   * - `new Transaction(this);`，创建一个针对当前状态的事务, every get returns a new tr
   */
  get tr(): Transaction {
    return new Transaction(this);
  }

  /** Apply the given transaction to produce a new state.
   * - 提交一个事务，让每个插件返回一个更新状态，然后构成一个新的EditorState
   */
  apply(tr: Transaction): EditorState {
    return this.applyTransaction(tr).state;
  }

  /// @internal
  filterTransaction(tr: Transaction, ignore = -1) {
    for (let i = 0; i < this.config.plugins.length; i++)
      if (i !== ignore) {
        const plugin = this.config.plugins[i];
        if (
          plugin.spec.filterTransaction &&
          !plugin.spec.filterTransaction.call(plugin, tr, this)
        ) {
          return false;
        }
      }
    return true;
  }

  /** Verbose variant of [`apply`](#state.EditorState.apply) that
   * returns the precise transactions that were applied (which might
   * be influenced by the [transaction hooks](#state.PluginSpec.filterTransaction)
   * of plugins) along with the new state.
   */
  applyTransaction(rootTr: Transaction): {
    state: EditorState;
    transactions: readonly Transaction[];
  } {
    if (!this.filterTransaction(rootTr)) {
      return { state: this, transactions: [] };
    }

    const trs = [rootTr];
    let newState = this.applyInner(rootTr);
    let seen = null as Array<{ state: EditorState; n: number }> | null;
    // This loop repeatedly gives plugins a chance to respond to
    // transactions as new transactions are added, making sure to only
    // pass the transactions the plugin did not see before.
    // eslint-disable-next-line no-labels, no-unused-labels
    outer: for (;;) {
      let haveNew = false;
      for (let i = 0; i < this.config.plugins.length; i++) {
        const plugin = this.config.plugins[i];
        if (plugin.spec.appendTransaction) {
          const n = seen ? seen[i].n : 0;
          const oldState = seen ? seen[i].state : this;
          const tr =
            n < trs.length &&
            plugin.spec.appendTransaction.call(
              plugin,
              n ? trs.slice(n) : trs,
              oldState,
              newState,
            );
          if (tr && newState.filterTransaction(tr, i)) {
            tr.setMeta('appendedTransaction', rootTr);
            if (!seen) {
              seen = [];
              // eslint-disable-next-line max-depth
              for (let j = 0; j < this.config.plugins.length; j++)
                seen.push(
                  j < i
                    ? { state: newState, n: trs.length }
                    : { state: this, n: 0 },
                );
            }
            trs.push(tr);
            newState = newState.applyInner(tr);
            haveNew = true;
          }
          if (seen) seen[i] = { state: newState, n: trs.length };
        }
      }
      if (!haveNew) return { state: newState, transactions: trs };
    }
  }

  /**
   * create a new EditorState, and
   *  @internal
   */
  applyInner(tr: Transaction) {
    if (!tr.before.eq(this.doc)) {
      throw new RangeError('Applying a mismatched transaction');
    }

    const newInstance = new EditorState(this.config);
    const fields = this.config.fields;
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      // compute plugin's new state
      (newInstance as any)[field.name] = field.apply(
        tr,
        // plugin's old state
        (this as any)[field.name],
        this,
        newInstance,
      );
    }
    return newInstance;
  }

  /** Create a new state. plugin.state is added to editorState instance directly
   * - 不能直接用new EditorState()的原因是，创建state对象后要立即将plugins的状态初始化并挂载到state对象下
   */
  static create(config: EditorStateConfig) {
    const _config = new Configuration(
      config.doc ? config.doc.type.schema : config.schema!,
      config.plugins,
    );
    const instance = new EditorState(_config);
    for (let i = 0; i < _config.fields.length; i++)
      (instance as any)[_config.fields[i].name] = _config.fields[i].init(
        config,
        instance,
      );
    return instance;
  }

  /** Create a new state based on this one, but with an adjusted set
   * of active plugins. State fields that exist in both sets of
   * plugins are kept unchanged. Those that no longer exist are
   * dropped, and those that are new are initialized using their
   * [`init`](#state.StateField.init) method, passing in the new
   * configuration object.
   */
  reconfigure(config: {
    /** New set of active plugins. */
    plugins?: readonly Plugin[];
  }) {
    const $config = new Configuration(this.schema, config.plugins);
    const fields = $config.fields;
    const instance = new EditorState($config);
    for (let i = 0; i < fields.length; i++) {
      const name = fields[i].name;
      (instance as any)[name] = this.hasOwnProperty(name)
        ? (this as any)[name]
        : fields[i].init(config, instance);
    }
    return instance;
  }

  /** Serialize this state to JSON. If you want to serialize the state
   * of plugins, pass an object mapping property names to use in the
   * resulting JSON object to plugin objects. The argument may also be
   * a string or number, in which case it is ignored, to support the
   * way `JSON.stringify` calls `toString` methods.
   */
  toJSON(pluginFields?: { [propName: string]: Plugin }): any {
    const result: any = {
      doc: this.doc.toJSON(),
      selection: this.selection.toJSON(),
    };
    if (this.storedMarks)
      result.storedMarks = this.storedMarks.map((m) => m.toJSON());
    if (pluginFields && typeof pluginFields === 'object')
      // eslint-disable-next-line guard-for-in
      for (const prop in pluginFields) {
        if (prop == 'doc' || prop == 'selection')
          throw new RangeError(
            'The JSON fields `doc` and `selection` are reserved',
          );
        const plugin = pluginFields[prop];
        const state = plugin.spec.state;
        if (state && state.toJSON)
          result[prop] = state.toJSON.call(plugin, (this as any)[plugin.key]);
      }
    return result;
  }

  /** Deserialize a JSON representation of a state. `config` should
   * have at least a `schema` field, and should contain array of
   * plugins to initialize the state with. `pluginFields` can be used
   * to deserialize the state of plugins, by associating plugin
   * instances with the property names they use in the JSON object.
   */
  static fromJSON(
    config: {
      /** The schema to use. */
      schema: Schema;
      /** The set of active plugins. */
      plugins?: readonly Plugin[];
    },
    json: any,
    pluginFields?: { [propName: string]: Plugin },
  ) {
    if (!json) throw new RangeError('Invalid input for EditorState.fromJSON');
    if (!config.schema)
      throw new RangeError("Required config field 'schema' missing");
    const $config = new Configuration(config.schema, config.plugins);
    const instance = new EditorState($config);
    $config.fields.forEach((field) => {
      if (field.name === 'doc') {
        instance.doc = Node.fromJSON(config.schema, json.doc);
      } else if (field.name === 'selection') {
        instance.selection = Selection.fromJSON(instance.doc, json.selection);
      } else if (field.name === 'storedMarks') {
        if (json.storedMarks)
          instance.storedMarks = json.storedMarks.map(
            config.schema.markFromJSON,
          );
      } else {
        if (pluginFields)
          // eslint-disable-next-line guard-for-in
          for (const prop in pluginFields) {
            const plugin = pluginFields[prop];
            const state = plugin.spec.state;
            if (
              plugin.key === field.name &&
              state &&
              state.fromJSON &&
              Object.hasOwn(json, prop)
            ) {
              // This field belongs to a plugin mapped to a JSON field, read it from there.
              (instance as any)[field.name] = state.fromJSON.call(
                plugin,
                config,
                json[prop],
                instance,
              );
              return;
            }
          }
        (instance as any)[field.name] = field.init(config, instance);
      }
    });
    return instance;
  }
}
