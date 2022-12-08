import { EventEmitter } from 'node:events';
import { callbackify, deprecate } from 'node:util';

import { Cursor } from './cursor';
import { Executor } from './executor';
import { Index } from './indexes';
import * as model from './model';
import { Persistence } from './persistence';
import type {
  DataStoreOptionsProps,
  EnsureIndexOptions,
} from './types/datastore';
import { PersistenceOptionsProps } from './types/datastore';
import { isDate } from './utils';
import { uid } from './utils-polyfillable';

/** ✨ One datastore is the equivalent of a MongoDB collection.
 * - The native types are String, Number, Boolean, Date and null. You can also use arrays and subdocuments (objects).
 * - A copy of the whole database is kept in memory.
 */
export class Datastore extends EventEmitter implements DataStoreOptionsProps {
  public autoload = false;
  public onload: DataStoreOptionsProps['onload'] | null;
  public filename: DataStoreOptionsProps['filename'];
  public inMemoryOnly = false;
  public timestampData = false;
  public compareStrings?: DataStoreOptionsProps['compareStrings'] | null;

  /** The `Persistence` instance for this `Datastore`. */
  public persistence: Persistence;
  /** The `Executor` instance for this `Datastore`. It is used in all methods exposed by the {@link Datastore},
   * any {@link Cursor} produced by the `Datastore` and by {@link Datastore#compactDatafileAsync} to ensure operations
   * are performed sequentially in the database.
   * @internal
   */
  public executor: Executor;
  /** Indexed by field name, dot notation can be used.
   * - `_id` is always indexed and since _ids are generated randomly the underlying binary search tree is always well-balanced
   * @internal
   */
  public indexes: Record<'_id' | string, Index>;
  /** Stores the time to live (TTL) of the indexes created. The key represents the field name, the value the number of
   * seconds after which data with this index field should be removed.
   * @internal
   */
  public ttlIndexes: Record<string, number>;
  /** A Promise that resolves when the autoload has finished. 仅构造函数中使用
   * - The onload callback is not awaited by this Promise, it is started immediately after that.
   */
  private autoloadPromise: Promise<any> | null;
  /** return value from setInterval, type is number.
   * - Interval if {@link Datastore#setAutocompactionInterval} was called. */
  private _autocompactionIntervalId: ReturnType<typeof setInterval> | null;

  /** Create a new collection, either persistent or in-memory.
   *
   * - If you use a persistent datastore without the `autoload` option, you need to call {@link Datastore#loadDatabase} or
   * {@link Datastore#loadDatabaseAsync} manually. This function fetches the data from datafile and prepares the database.
   * **Don't forget it!** If you use a persistent datastore, no command (insert, find, update, remove) will be executed
   * before it is called, so make sure to call it yourself or use the `autoload` option.
   */
  constructor(options: string | (DataStoreOptionsProps & PersistenceOptionsProps) = {}) {
    super();
    let filename: string;

    // Retrocompatibility with v0.6 and before
    if (typeof options === 'string') {
      deprecate(() => {
        filename = options as string;
        this.inMemoryOnly = false; // Default
      }, "nedb: Giving a string to the Datastore constructor is deprecated and will be removed in the next major version. Please use an options object with an argument 'filename'.")();
    } else {
      options = options || {};
      filename = options.filename;
      this.inMemoryOnly = options.inMemoryOnly || false;
      this.autoload = options.autoload || false;
      this.timestampData = options.timestampData || false;
    }

    if (!filename || typeof filename !== 'string' || filename.length === 0) {
      // /Determine whether in memory or persistent
      this.filename = null;
      this.inMemoryOnly = true;
    } else {
      this.filename = filename;
    }

    if (typeof options === 'string') return;

    this.compareStrings = options.compareStrings;
    this.persistence = new Persistence({
      db: this,
      afterSerialization: options.afterSerialization,
      beforeDeserialization: options.beforeDeserialization,
      corruptAlertThreshold: options.corruptAlertThreshold,
      modes: options.modes,
      testSerializationHooks: options.testSerializationHooks,
    });
    this.executor = new Executor();
    if (this.inMemoryOnly) {
      this.executor.ready = true;
    }
    this.indexes = {};
    this.indexes._id = new Index({ fieldName: '_id', unique: true });
    this.ttlIndexes = {};

    // Queue a load of the database right away and call the onload handler
    // By default (no onload handler), if there is an error there, no operation will be possible so warn the user by throwing an exception
    if (this.autoload) {
      this.autoloadPromise = this.loadDatabaseAsync();
      this.autoloadPromise.then(
        () => {
          if (typeof options === 'object' && options.onload) {
            options.onload();
          }
        },
        (err) => {
          if (typeof options === 'object' && options.onload) {
            options.onload(err);
          } else throw err;
        },
      );
    } else {
      this.autoloadPromise = null;
    }

    this._autocompactionIntervalId = null;
  }

  /**
   * Queue a compaction/rewrite of the datafile.
   * It works by rewriting the database file, and compacts it since the cache always contains only the number of
   * documents in the collection while the data file is append-only so it may grow larger.
   *
   */
  async compactDatafileAsync() {
    return this.executor.pushAsync(() =>
      this.persistence.persistCachedDatabaseAsync(),
    );
  }

  /** queues a compaction of the datafile in the executor, to be executed sequentially after all pending operations.
   * - The datastore will fire a `compaction.done` event once compaction is finished.
   * - Compaction will immediately remove any documents whose data line has become corrupted
   * - compaction forces the OS to physically flush data to disk, while appends to the data file do not (the OS is responsible for flushing the data).
   * - Callback version of {@link Datastore#compactDatafileAsync}.
   * @param {NoParamCallback} [callback = () => {}]
   * @see Datastore#compactDatafileAsync
   */
  compactDatafile(callback?: (arg: any) => void) {
    const promise = this.compactDatafileAsync();
    if (typeof callback === 'function') callbackify(() => promise)(callback);
  }

  /**
   * Set automatic compaction every `interval` ms
   * @param {Number} interval in milliseconds, with an enforced minimum of 5000 milliseconds
   */
  setAutocompactionInterval(interval) {
    const minInterval = 5000;
    if (Number.isNaN(Number(interval)))
      throw new Error('Interval must be a non-NaN number');
    const realInterval = Math.max(Number(interval), minInterval);

    this.stopAutocompaction();

    this._autocompactionIntervalId = setInterval(() => {
      this.compactDatafile();
    }, realInterval);
  }

  /**
   * Stop autocompaction (do nothing if automatic compaction was not running)
   */
  stopAutocompaction() {
    if (this._autocompactionIntervalId) {
      clearInterval(this._autocompactionIntervalId);
      this._autocompactionIntervalId = null;
    }
  }

  /**
   * Callback version of {@link Datastore#loadDatabaseAsync}.
   * @param {NoParamCallback} [callback]
   * @see Datastore#loadDatabaseAsync
   */
  loadDatabase(callback) {
    const promise = this.loadDatabaseAsync();
    if (typeof callback === 'function') callbackify(() => promise)(callback);
  }

  /**
   * Stops auto-compaction, finishes all queued operations, drops the database both in memory and in storage.
   * **WARNING**: it is not recommended re-using an instance of NeDB if its database has been dropped, it is
   * preferable to instantiate a new one.
   * @async
   * @return {Promise}
   */
  dropDatabaseAsync() {
    return this.persistence.dropDatabaseAsync(); // the executor is exceptionally used by Persistence
  }

  /**
   * Callback version of {@link Datastore#dropDatabaseAsync}.
   * @param {NoParamCallback} [callback]
   * @see Datastore#dropDatabaseAsync
   */
  dropDatabase(callback) {
    const promise = this.dropDatabaseAsync();
    if (typeof callback === 'function') callbackify(() => promise)(callback);
  }

  /**
   * Load the database from the datafile, and trigger the execution of buffered commands if any.
   * @async
   * @return {Promise}
   */
  async loadDatabaseAsync() {
    return this.executor.pushAsync(
      () => this.persistence.loadDatabaseAsync(),
      true,
    );
  }

  /**
   * Get an array of all the data in the database.
   * @return {document[]}
   */
  getAllData() {
    return this.indexes._id.getAll();
  }

  /**
   * Reset all currently defined indexes.
   * @param {?document|?document[]} [newData]
   * @private
   */
  _resetIndexes(newData = undefined) {
    for (const index of Object.values(this.indexes)) {
      index.reset(newData);
    }
  }

  /**
   * Callback version of {@link Datastore#ensureIndex}.
   * @param {object} options
   * @param {string} options.fieldName
   * @param {boolean} [options.unique = false]
   * @param {boolean} [options.sparse = false]
   * @param {number} [options.expireAfterSeconds]
   * @param {NoParamCallback} [callback]
   * @see Datastore#ensureIndex
   */
  ensureIndex(options = {}, callback) {
    const promise = this.ensureIndexAsync(options); // to make sure the synchronous part of ensureIndexAsync is executed synchronously
    if (typeof callback === 'function') callbackify(() => promise)(callback);
  }

  /**
   * Ensure an index is kept for this field. Same parameters as lib/indexes
   * This function acts synchronously on the indexes, however the persistence of the indexes is deferred with the
   * executor.
   * @param {object} options
   * @param {string} options.fieldName Name of the field to index. Use the dot notation to index a field in a nested
   * document.
   * @param {boolean} [options.unique = false] Enforce field uniqueness. Note that a unique index will raise an error
   * if you try to index two documents for which the field is not defined.
   * @param {boolean} [options.sparse = false] Don't index documents for which the field is not defined. Use this option
   * along with "unique" if you want to accept multiple documents for which it is not defined.
   * @param {number} [options.expireAfterSeconds] - If set, the created index is a TTL (time to live) index, that will
   * automatically remove documents when the system date becomes larger than the date on the indexed field plus
   * `expireAfterSeconds`. Documents where the indexed field is not specified or not a `Date` object are ignored.
   * @return {Promise<void>}
   */
  async ensureIndexAsync(options: EnsureIndexOptions = {}) {
    if (!options.fieldName) {
      const err = new Error('Cannot create an index without a fieldName');
      err['missingFieldName'] = true;
      throw err;
    }
    if (this.indexes[options.fieldName]) return;

    this.indexes[options.fieldName] = new Index(options);
    if (options.expireAfterSeconds !== undefined)
      this.ttlIndexes[options.fieldName] = options.expireAfterSeconds; // With this implementation index creation is not necessary to ensure TTL but we stick with MongoDB's API here

    try {
      this.indexes[options.fieldName].insert(this.getAllData());
    } catch (e) {
      delete this.indexes[options.fieldName];
      throw e;
    }

    // We may want to force all options to be persisted including defaults, not just the ones passed the index creation function
    await this.executor.pushAsync(
      () =>
        this.persistence.persistNewStateAsync([{ $$indexCreated: options }]),
      true,
    );
  }

  /**
   * Callback version of {@link Datastore#removeIndexAsync}.
   * @param {string} fieldName
   * @param {NoParamCallback} [callback]
   * @see Datastore#removeIndexAsync
   */
  removeIndex(fieldName, callback = () => { }) {
    const promise = this.removeIndexAsync(fieldName);
    callbackify(() => promise)(callback);
  }

  /**
   * Remove an index.
   * @param {string} fieldName Field name of the index to remove. Use the dot notation to remove an index referring to a
   * field in a nested document.
   * @return {Promise<void>}
   * @see Datastore#removeIndex
   */
  async removeIndexAsync(fieldName) {
    delete this.indexes[fieldName];

    await this.executor.pushAsync(
      () =>
        this.persistence.persistNewStateAsync([{ $$indexRemoved: fieldName }]),
      true,
    );
  }

  /**
   * Add one or several document(s) to all indexes.
   *
   * This is an internal function.
   * @param {document} doc
   * @private
   */
  _addToIndexes(doc) {
    let failingIndex;
    let error;
    const keys = Object.keys(this.indexes);

    for (let i = 0; i < keys.length; i += 1) {
      try {
        this.indexes[keys[i]].insert(doc);
      } catch (e) {
        failingIndex = i;
        error = e;
        break;
      }
    }

    // If an error happened, we need to rollback the insert on all other indexes
    if (error) {
      for (let i = 0; i < failingIndex; i += 1) {
        this.indexes[keys[i]].remove(doc);
      }

      throw error;
    }
  }

  /**
   * Remove one or several document(s) from all indexes.
   *
   * This is an internal function.
   * @param {document} doc
   * @private
   */
  _removeFromIndexes(doc) {
    for (const index of Object.values(this.indexes)) {
      index.remove(doc);
    }
  }

  /**
   * Update one or several documents in all indexes.
   *
   * To update multiple documents, oldDoc must be an array of { oldDoc, newDoc } pairs.
   *
   * If one update violates a constraint, all changes are rolled back.
   *
   * This is an internal function.
   * @param {document|Array.<{oldDoc: document, newDoc: document}>} oldDoc Document to update, or an `Array` of
   * `{oldDoc, newDoc}` pairs.
   * @param {document} [newDoc] Document to replace the oldDoc with. If the first argument is an `Array` of
   * `{oldDoc, newDoc}` pairs, this second argument is ignored.
   * @private
   */
  _updateIndexes(oldDoc, newDoc = undefined) {
    let failingIndex;
    let error;
    const keys = Object.keys(this.indexes);

    for (let i = 0; i < keys.length; i += 1) {
      try {
        this.indexes[keys[i]].update(oldDoc, newDoc);
      } catch (e) {
        failingIndex = i;
        error = e;
        break;
      }
    }

    // If an error happened, we need to rollback the update on all other indexes
    if (error) {
      for (let i = 0; i < failingIndex; i += 1) {
        this.indexes[keys[i]].revertUpdate(oldDoc, newDoc);
      }

      throw error;
    }
  }

  /**
   * Get all candidate documents matching the query, regardless of their expiry status.
   * @param {query} query
   * @return {document[]}
   *
   * @private
   */
  _getRawCandidates(query) {
    const indexNames = Object.keys(this.indexes);
    // STEP 1: get candidates list by checking indexes from most to least frequent usecase
    // For a basic match
    let usableQuery;
    usableQuery = Object.entries(query)
      .filter(
        ([k, v]) =>
          Boolean(
            typeof v === 'string' ||
            typeof v === 'number' ||
            typeof v === 'boolean' ||
            isDate(v) ||
            v === null,
          ) && indexNames.includes(k),
      )
      .pop();
    if (usableQuery)
      return this.indexes[usableQuery[0]].getMatching(usableQuery[1]);
    // For a $in match
    usableQuery = Object.entries(query)
      .filter(
        ([k, v]) =>
          Boolean(query[k] && Object.hasOwn(query[k], '$in')) &&
          indexNames.includes(k),
      )
      .pop();
    if (usableQuery)
      return this.indexes[usableQuery[0]].getMatching(usableQuery[1].$in);
    // For a comparison match
    usableQuery = Object.entries(query)
      .filter(
        ([k, v]) =>
          Boolean(
            query[k] &&
            (Object.hasOwn(query[k], '$lt') ||
              Object.hasOwn(query[k], '$lte') ||
              Object.hasOwn(query[k], '$gt') ||
              Object.hasOwn(query[k], '$gte')),
          ) && indexNames.includes(k),
      )
      .pop();
    if (usableQuery)
      return this.indexes[usableQuery[0]].getBetweenBounds(usableQuery[1]);
    // By default, return all the DB data
    return this.getAllData();
  }

  /**
   * Return the list of candidates for a given query
   * Crude implementation for now, we return the candidates given by the first usable index if any
   * We try the following query types, in this order: basic match, $in match, comparison match
   * One way to make it better would be to enable the use of multiple indexes if the first usable index
   * returns too much data. I may do it in the future.
   *
   * Returned candidates will be scanned to find and remove all expired documents
   *
   * This is an internal function.
   * @param {query} query
   * @param {boolean} [dontExpireStaleDocs = false] If true don't remove stale docs. Useful for the remove function
   * which shouldn't be impacted by expirations.
   * @return {Promise<document[]>} candidates
   * @private
   */
  async _getCandidatesAsync(query, dontExpireStaleDocs = false) {
    const validDocs = [];

    // STEP 1: get candidates list by checking indexes from most to least frequent usecase
    const docs = this._getRawCandidates(query);
    // STEP 2: remove all expired documents
    if (!dontExpireStaleDocs) {
      const expiredDocsIds = [];
      const ttlIndexesFieldNames = Object.keys(this.ttlIndexes);

      docs.forEach((doc) => {
        if (
          ttlIndexesFieldNames.every(
            (i) =>
              !(
                doc[i] !== undefined &&
                isDate(doc[i]) &&
                Date.now() > doc[i].getTime() + this.ttlIndexes[i] * 1000
              ),
          )
        )
          validDocs.push(doc);
        else expiredDocsIds.push(doc._id);
      });
      for (const _id of expiredDocsIds) {
        await this._removeAsync({ _id: _id }, {});
      }
    } else validDocs.push(...docs);
    return validDocs;
  }

  /**
   * Insert a new document
   * This is an internal function, use {@link Datastore#insertAsync} which has the same signature.
   * @param {document|document[]} newDoc
   * @return {Promise<document|document[]>}
   * @private
   */
  async _insertAsync(newDoc) {
    const preparedDoc = this._prepareDocumentForInsertion(newDoc);
    this._insertInCache(preparedDoc);

    await this.persistence.persistNewStateAsync(
      Array.isArray(preparedDoc) ? preparedDoc : [preparedDoc],
    );
    return model.deepCopy(preparedDoc);
  }

  /**
   * Create a new _id that's not already in use
   * @return {string} id
   * @private
   */
  _createNewId() {
    let attemptId = uid(16);
    // Try as many times as needed to get an unused _id. As explained in customUtils, the probability of this ever happening is extremely small, so this is O(1)
    if (this.indexes._id.getMatching(attemptId).length > 0)
      attemptId = this._createNewId();
    return attemptId;
  }

  /**
   * Prepare a document (or array of documents) to be inserted in a database
   * Meaning adds _id and timestamps if necessary on a copy of newDoc to avoid any side effect on user input
   * @param {document|document[]} newDoc document, or Array of documents, to prepare
   * @return {document|document[]} prepared document, or Array of prepared documents
   * @private
   */
  _prepareDocumentForInsertion(newDoc) {
    let preparedDoc;

    if (Array.isArray(newDoc)) {
      preparedDoc = [];
      newDoc.forEach((doc) => {
        preparedDoc.push(this._prepareDocumentForInsertion(doc));
      });
    } else {
      preparedDoc = model.deepCopy(newDoc);
      if (preparedDoc._id === undefined) preparedDoc._id = this._createNewId();
      const now = new Date();
      if (this.timestampData && preparedDoc.createdAt === undefined)
        preparedDoc.createdAt = now;
      if (this.timestampData && preparedDoc.updatedAt === undefined)
        preparedDoc.updatedAt = now;
      model.checkObject(preparedDoc);
    }

    return preparedDoc;
  }

  /**
   * If newDoc is an array of documents, this will insert all documents in the cache
   * @param {document|document[]} preparedDoc
   * @private
   */
  _insertInCache(preparedDoc) {
    if (Array.isArray(preparedDoc))
      this._insertMultipleDocsInCache(preparedDoc);
    else this._addToIndexes(preparedDoc);
  }

  /**
   * If one insertion fails (e.g. because of a unique constraint), roll back all previous
   * inserts and throws the error
   * @param {document[]} preparedDocs
   * @private
   */
  _insertMultipleDocsInCache(preparedDocs) {
    let failingIndex;
    let error;

    for (let i = 0; i < preparedDocs.length; i += 1) {
      try {
        this._addToIndexes(preparedDocs[i]);
      } catch (e) {
        error = e;
        failingIndex = i;
        break;
      }
    }

    if (error) {
      for (let i = 0; i < failingIndex; i += 1) {
        this._removeFromIndexes(preparedDocs[i]);
      }

      throw error;
    }
  }

  /**
   * Callback version of {@link Datastore#insertAsync}.
   * @param {document|document[]} newDoc
   * @param {SingleDocumentCallback|MultipleDocumentsCallback} [callback]
   * @see Datastore#insertAsync
   */
  insert(newDoc, callback = undefined) {
    const promise = this.insertAsync(newDoc);
    if (typeof callback === 'function') callbackify(() => promise)(callback);
  }

  /**
   * Insert a new document, or new documents.
   * - If a field is `undefined`, it will not be saved (this is different from MongoDB which transforms `undefined` in `null`).
   * - Field names cannot begin by `$` or contain `.`.
   * - If the document does not contain an `_id` field, NeDB will automatically generated an immutable one for you (a 16-characters alphanumerical string).
   * @param {document|document[]} newDoc Document or array of documents to insert.
   * @return {Promise<document|document[]>} The document(s) inserted.
   * @async
   */
  insertAsync(newDoc) {
    return this.executor.pushAsync(() => this._insertAsync(newDoc));
  }

  /**
   * Callback for {@link Datastore#countCallback}.
   * @callback Datastore~countCallback
   * @param {?Error} err
   * @param {?number} count
   */

  /**
   * Callback-version of {@link Datastore#countAsync}.
   * @param {query} query
   * @param {Datastore~countCallback} [callback]
   * @return {Cursor<number>|undefined}
   * @see Datastore#countAsync
   */
  count(query, callback) {
    const cursor = this.countAsync(query);

    if (typeof callback === 'function')
      callbackify(cursor.execAsync.bind(cursor))(callback);
    else return cursor;
  }

  /**
   * Count all documents matching the query.
   * - It has the same syntax as `find`
   * @param {query} query MongoDB-style query
   * @return {Cursor<number>} count
   * @async
   */
  countAsync(query) {
    return new Cursor(this, query, (docs) => docs.length);
  }

  /**
   * Callback version of {@link Datastore#findAsync}.
   * @param {query} query
   * @param {projection|MultipleDocumentsCallback} [projection = {}]
   * @param {MultipleDocumentsCallback} [callback]
   * @return {Cursor<document[]>|undefined}
   * @see Datastore#findAsync
   */
  find(query, projection = {}, callback = undefined) {
    if (arguments.length === 1) {
      projection = {};
      // callback is undefined, will return a cursor
    } else if (arguments.length === 2) {
      if (typeof projection === 'function') {
        callback = projection;
        projection = {};
      } // If not assume projection is an object and callback undefined
    }

    const cursor = this.findAsync(query, projection);

    if (typeof callback === 'function')
      callbackify(cursor.execAsync.bind(cursor))(callback);
    else return cursor;
  }

  /**
   * Find all documents matching the query.
   * - You can select documents based on field equality or use comparison operators ($lt, $lte, $gt, $gte, $in, $nin, $ne).
   * - You can use the dot notation to navigate inside nested documents, arrays, arrays of subdocuments and to match a specific element of an array.
   * - We return the {@link Cursor} that the user can either `await` directly or use to can {@link Cursor#limit} or
   * {@link Cursor#skip} before.
   * @param {query} query MongoDB-style query
   * @param {projection} [projection = {}] MongoDB-style projection {propName: 1/0} to filter props returned
   * @return {Cursor<document[]>}
   * @async
   */
  findAsync(query, projection = {}) {
    const cursor = new Cursor(this, query, (docs) =>
      docs.map((doc) => model.deepCopy(doc)),
    );

    cursor.projection(projection);
    return cursor;
  }

  /**
   * @callback Datastore~findOneCallback
   * @param {?Error} err
   * @param {document} doc
   */

  /**
   * Callback version of {@link Datastore#findOneAsync}.
   * @param {query} query
   * @param {projection|SingleDocumentCallback} [projection = {}]
   * @param {SingleDocumentCallback} [callback]
   * @return {Cursor<document>|undefined}
   * @see Datastore#findOneAsync
   */
  findOne(query, projection, callback = undefined) {
    if (arguments.length === 1) {
      projection = {};
      // callback is undefined, will return a cursor
    } else if (arguments.length === 2) {
      if (typeof projection === 'function') {
        callback = projection;
        projection = {};
      } // If not assume projection is an object and callback undefined
    }

    const cursor = this.findOneAsync(query, projection);

    if (typeof callback === 'function')
      callbackify(cursor.execAsync.bind(cursor))(callback);
    else return cursor;
  }

  /**
   * Find one document matching the query.
   * We return the {@link Cursor} that the user can either `await` directly or use to can {@link Cursor#skip} before.
   * @param {query} query MongoDB-style query
   * @param {projection} projection MongoDB-style projection
   * @return {Cursor<document>}
   */
  findOneAsync(query, projection = {}) {
    const cursor = new Cursor(this, query, (docs) =>
      docs.length === 1 ? model.deepCopy(docs[0]) : null,
    );

    cursor.projection(projection).limit(1);
    return cursor;
  }

  /**
   * See {@link Datastore#updateAsync} return type for the definition of the callback parameters.
   *
   * **WARNING:** Prior to 3.0.0, `upsert` was either `true` of falsy (but not `false`), it is now always a boolean.
   * `affectedDocuments` could be `undefined` when `returnUpdatedDocs` was `false`, it is now `null` in these cases.
   *
   * **WARNING:** Prior to 1.8.0, the `upsert` argument was not given, it was impossible for the developer to determine
   * during a `{ multi: false, returnUpdatedDocs: true, upsert: true }` update if it inserted a document or just updated
   * it.
   *
   * @callback Datastore~updateCallback
   * @param {?Error} err
   * @param {number} numAffected
   * @param {?document[]|?document} affectedDocuments
   * @param {boolean} upsert
   * @see {Datastore#updateAsync}
   */

  /**
   * Version without the using {@link Datastore~executor} of {@link Datastore#updateAsync}, use it instead.
   *
   * @param {query} query
   * @param {document|update} update
   * @param {Object} options
   * @param {boolean} [options.multi = false]
   * @param {boolean} [options.upsert = false]
   * @param {boolean} [options.returnUpdatedDocs = false]
   * @return {Promise<{numAffected: number, affectedDocuments: document[]|document|null, upsert: boolean}>}
   * @private
   * @see Datastore#updateAsync
   */
  async _updateAsync(query, update, options) {
    const multi = options.multi !== undefined ? options.multi : false;
    const upsert = options.upsert !== undefined ? options.upsert : false;

    // If upsert option is set, check whether we need to insert the doc
    if (upsert) {
      const cursor = new Cursor(this, query);

      // Need to use an internal function not tied to the executor to avoid deadlock
      const docs = await cursor.limit(1)._execAsync();

      if (docs.length !== 1) {
        let toBeInserted;

        try {
          model.checkObject(update);
          // updateQuery is a simple object with no modifier, use it as the document to insert
          toBeInserted = update;
        } catch (e) {
          // updateQuery contains modifiers, use the find query as the base,
          // strip it from all operators and update it according to updateQuery
          toBeInserted = model.modify(model.deepCopy(query, true), update);
        }
        const newDoc = await this._insertAsync(toBeInserted);
        return { numAffected: 1, affectedDocuments: newDoc, upsert: true };
      }
    }
    // Perform the update
    let numReplaced = 0;
    let modifiedDoc;
    const modifications = [];
    let createdAt;

    const candidates = await this._getCandidatesAsync(query);
    // Preparing update (if an error is thrown here neither the datafile nor
    // the in-memory indexes are affected)
    for (const candidate of candidates) {
      if (model.match(candidate, query) && (multi || numReplaced === 0)) {
        numReplaced += 1;
        if (this.timestampData) {
          createdAt = candidate.createdAt;
        }
        modifiedDoc = model.modify(candidate, update);
        if (this.timestampData) {
          modifiedDoc.createdAt = createdAt;
          modifiedDoc.updatedAt = new Date();
        }
        modifications.push({ oldDoc: candidate, newDoc: modifiedDoc });
      }
    }

    // Change the docs in memory
    this._updateIndexes(modifications);

    // Update the datafile
    const updatedDocs = modifications.map((x) => x.newDoc);
    await this.persistence.persistNewStateAsync(updatedDocs);
    if (!options.returnUpdatedDocs)
      return {
        numAffected: numReplaced,
        upsert: false,
        affectedDocuments: null,
      };
    else {
      let updatedDocsDC = [];
      updatedDocs.forEach((doc) => {
        updatedDocsDC.push(model.deepCopy(doc));
      });
      if (!multi) updatedDocsDC = updatedDocsDC[0];
      return {
        numAffected: numReplaced,
        affectedDocuments: updatedDocsDC,
        upsert: false,
      };
    }
  }

  /**
   * Callback version of {@link Datastore#updateAsync}.
   * @param {query} query
   * @param {document|*} update
   * @param {Object|Datastore~updateCallback} [options|]
   * @param {boolean} [options.multi = false]
   * @param {boolean} [options.upsert = false]
   * @param {boolean} [options.returnUpdatedDocs = false]
   * @param {Datastore~updateCallback} [callback]
   * @see Datastore#updateAsync
   *
   */
  update(query, update, options, callback = undefined) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const _callback = (err, res: any = {}) => {
      if (callback)
        callback(err, res.numAffected, res.affectedDocuments, res.upsert);
    };
    callbackify((query, update, options) =>
      this.updateAsync(query, update, options),
    )(query, update, options, _callback);
  }

  /**
   * Update all docs matching query.
   * @param {query} query is the same kind of finding query you use with `find` and `findOne`.
   * @param {document|*} update specifies how the documents should be modified. It is either a new document or a
   * set of modifiers (you cannot use both together, it doesn't make sense!). Using a new document will replace the
   * matched docs. Using a set of modifiers will create the fields they need to modify if they don't exist, and you can
   * apply them to subdocs. Available field modifiers are `$set` to change a field's value, `$unset` to delete a field,
   * `$inc` to increment a field's value and `$min`/`$max` to change field's value, only if provided value is
   * less/greater than current value. To work on arrays, you have `$push`, `$pop`, `$addToSet`, `$pull`, and the special
   * `$each` and `$slice`.
   * @param {Object} [options = {}] Optional options
   * @param {boolean} [options.multi = false] If true, can update multiple documents
   * @param {boolean} [options.upsert = false] If true, can insert a new document corresponding to the `update` rules if
   * your `query` doesn't match anything. If your `update` is a simple object with no modifiers, it is the inserted
   * document. In the other case, the `query` is stripped from all operator recursively, and the `update` is applied to
   * it.
   * @param {boolean} [options.returnUpdatedDocs = false] (not Mongo-DB compatible) If true and update is not an upsert,
   * will return the array of documents matched by the find query and updated. Updated documents will be returned even
   * if the update did not actually modify them.
   * @return {Promise<{numAffected: number, affectedDocuments: document[]|document|null, upsert: boolean}>}
   * - `upsert` is `true` if and only if the update did insert a document, **cannot be true if `options.upsert !== true`**.
   * - `numAffected` is the number of documents affected by the update or insertion (if `options.multi` is `false` or `options.upsert` is `true`, cannot exceed `1`);
   * - `affectedDocuments` can be one of the following:
   *    - If `upsert` is `true`, the inserted document;
   *    - If `options.returnUpdatedDocs` is `false`, `null`;
   *    - If `options.returnUpdatedDocs` is `true`:
   *      - If `options.multi` is `false`, the updated document;
   *      - If `options.multi` is `false`, the array of updated documents.
   * @async
   */
  updateAsync(query, update, options = {}) {
    return this.executor.pushAsync(() =>
      this._updateAsync(query, update, options),
    );
  }

  /**
   * @callback Datastore~removeCallback
   * @param {?Error} err
   * @param {?number} numRemoved
   */

  /**
   * Internal version without using the {@link Datastore#executor} of {@link Datastore#removeAsync}, use it instead.
   *
   * @param {query} query
   * @param {object} [options]
   * @param {boolean} [options.multi = false]
   * @return {Promise<number>}
   * @private
   * @see Datastore#removeAsync
   */
  async _removeAsync(query, options: { multi?: boolean } = {}) {
    const multi = options.multi !== undefined ? options.multi : false;

    const candidates = await this._getCandidatesAsync(query, true);
    const removedDocs = [];
    let numRemoved = 0;

    candidates.forEach((d) => {
      if (model.match(d, query) && (multi || numRemoved === 0)) {
        numRemoved += 1;
        removedDocs.push({ $$deleted: true, _id: d._id });
        this._removeFromIndexes(d);
      }
    });

    await this.persistence.persistNewStateAsync(removedDocs);
    return numRemoved;
  }

  /**
   * Callback version of {@link Datastore#removeAsync}.
   * @param {query} query
   * @param {object|Datastore~removeCallback} [options={}]
   * @param {boolean} [options.multi = false]
   * @param {Datastore~removeCallback} [cb = () => {}]
   * @see Datastore#removeAsync
   */
  remove(query, options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }
    const callback = cb || (() => { });
    callbackify((query, options) => this.removeAsync(query, options))(
      query,
      options,
      callback,
    );
  }

  /**
   * Remove all docs matching the query.
   * @param {query} query MongoDB-style query
   * @param {object} [options={}] Optional options
   * @param {boolean} [options.multi = false] If true, can update multiple documents
   * @return {Promise<number>} How many documents were removed
   * @async
   */
  removeAsync(query, options = {}) {
    return this.executor.pushAsync(() => this._removeAsync(query, options));
  }
}
