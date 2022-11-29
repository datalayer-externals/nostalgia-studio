import { AVLTree as BinarySearchTree } from './binary-tree';
import * as model from './model';
import { isDate, uniq } from './utils';

/**
 * Two indexed pointers are equal if they point to the same place
 * @param {*} a
 * @param {*} b
 * @return {boolean}
 * @private
 */
const checkValueEquality = (a, b) => a === b;

/**
 * Type-aware projection
 * @param {*} elt
 * @return {string|*}
 * @private
 */
const projectForUnique = (elt) => {
  if (elt === null) return '$null';
  if (typeof elt === 'string') return '$string' + elt;
  if (typeof elt === 'boolean') return '$boolean' + elt;
  if (typeof elt === 'number') return '$number' + elt;
  if (isDate(elt)) return '$date' + elt.getTime();

  return elt; // Arrays and objects, will check for pointer equality
};

/**
 * Indexes on field names, with atomic operations and which can optionally enforce a unique constraint or allow indexed
 * fields to be undefined
 * - You can index any field, including fields in nested documents using the dot notation.
 * - `_id` is automatically indexed with a unique constraint, no need to call ensureIndex on it.
 * - indexes are only used to speed up basic queries and queries using $in, $lt, $lte, $gt and $gte.
 * - The indexed values cannot be of type array of object.
 * - If your datastore is persistent, the indexes you created are persisted in the datafile, when you load the database a second time they are automatically created for you.
 * @private
 */
export class Index {
  /** name of the field to index. Use the dot notation to index a field in a nested document.
   */
  fieldName: string;
  /** enforce field uniqueness.
   * - Note that a unique index will raise an error if you try to index two documents for which the field is not defined. */
  unique?: boolean;
  /** don't index documents for which the field is not defined.
   * - Use this option along with "unique" if you want to accept multiple documents for which it is not defined.. */
  sparse: any;
  treeOptions: {
    unique: any;
    compareKeys: (a: any, b: any, _compareStrings: any) => any;
    checkValueEquality: (a: any, b: any) => boolean;
  };
  tree: any;

  /**
   * Create a new index
   * All methods on an index guarantee that either the whole operation was successful and the index changed
   * or the operation was unsuccessful and an error is thrown while the index is unchanged
   * @param {object} options
   * @param {string} options.fieldName On which field should the index apply (can use dot notation to index on sub fields)
   * @param {boolean} [options.unique = false] Enforces a unique constraint
   * @param {boolean} [options.sparse = false] Allows a sparse index (we can have documents for which fieldName is `undefined`)
   */
  constructor(options) {
    this.fieldName = options.fieldName;
    /**
     * Defines if the index enforces a unique constraint for this index.
     * @type {boolean}
     */
    this.unique = options.unique || false;
    /**
     * Defines if we can have documents for which fieldName is `undefined`
     * @type {boolean}
     */
    this.sparse = options.sparse || false;

    /**
     * Options object given to the underlying BinarySearchTree.
     * @type {{unique: boolean, checkValueEquality: (function(*, *): boolean), compareKeys: ((function(*, *, compareStrings): (number|number))|*)}}
     */
    this.treeOptions = {
      unique: this.unique,
      compareKeys: model.compareThings,
      checkValueEquality: checkValueEquality,
    };

    /**
     * Underlying BinarySearchTree for this index. Uses an AVLTree for optimization.
     * @type {AVLTree}
     */
    this.tree = new BinarySearchTree(this.treeOptions);
  }

  /**
   * Reset an index
   * @param {?document|?document[]} [newData] Data to initialize the index with. If an error is thrown during
   * insertion, the index is not modified.
   */
  reset(newData = undefined) {
    this.tree = new BinarySearchTree(this.treeOptions);

    if (newData) this.insert(newData);
  }

  /**
   * Insert a new document in the index
   * If an array is passed, we insert all its elements (if one insertion fails the index is not modified)
   * O(log(n))
   * @param {document|document[]} doc The document, or array of documents, to insert.
   */
  insert(doc) {
    let keys;
    let failingIndex;
    let error;

    if (Array.isArray(doc)) {
      this.insertMultipleDocs(doc);
      return;
    }

    const key = model.getDotValue(doc, this.fieldName);

    // We don't index documents that don't contain the field if the index is sparse
    if (key === undefined && this.sparse) return;

    if (!Array.isArray(key)) this.tree.insert(key, doc);
    else {
      // If an insert fails due to a unique constraint, roll back all inserts before it
      keys = uniq(key, projectForUnique);

      for (let i = 0; i < keys.length; i += 1) {
        try {
          this.tree.insert(keys[i], doc);
        } catch (e) {
          error = e;
          failingIndex = i;
          break;
        }
      }

      if (error) {
        for (let i = 0; i < failingIndex; i += 1) {
          this.tree.delete(keys[i], doc);
        }

        throw error;
      }
    }
  }

  /**
   * Insert an array of documents in the index
   * If a constraint is violated, the changes should be rolled back and an error thrown
   * @param {document[]} docs Array of documents to insert.
   * @private
   */
  insertMultipleDocs(docs) {
    let error;
    let failingIndex;

    for (let i = 0; i < docs.length; i += 1) {
      try {
        this.insert(docs[i]);
      } catch (e) {
        error = e;
        failingIndex = i;
        break;
      }
    }

    if (error) {
      for (let i = 0; i < failingIndex; i += 1) {
        this.remove(docs[i]);
      }

      throw error;
    }
  }

  /**
   * Removes a document from the index.
   * If an array is passed, we remove all its elements
   * The remove operation is safe with regards to the 'unique' constraint
   * O(log(n))
   * @param {document[]|document} doc The document, or Array of documents, to remove.
   */
  remove(doc) {
    if (Array.isArray(doc)) {
      doc.forEach((d) => {
        this.remove(d);
      });
      return;
    }

    const key = model.getDotValue(doc, this.fieldName);

    if (key === undefined && this.sparse) return;

    if (!Array.isArray(key)) {
      this.tree.delete(key, doc);
    } else {
      uniq(key, projectForUnique).forEach((_key) => {
        this.tree.delete(_key, doc);
      });
    }
  }

  /**
   * Update a document in the index
   * If a constraint is violated, changes are rolled back and an error thrown
   * Naive implementation, still in O(log(n))
   * @param {document|Array.<{oldDoc: document, newDoc: document}>} oldDoc Document to update, or an `Array` of
   * `{oldDoc, newDoc}` pairs.
   * @param {document} [newDoc] Document to replace the oldDoc with. If the first argument is an `Array` of
   * `{oldDoc, newDoc}` pairs, this second argument is ignored.
   */
  update(oldDoc, newDoc = undefined) {
    if (Array.isArray(oldDoc)) {
      this.updateMultipleDocs(oldDoc);
      return;
    }

    this.remove(oldDoc);

    try {
      this.insert(newDoc);
    } catch (e) {
      this.insert(oldDoc);
      throw e;
    }
  }

  /**
   * Update multiple documents in the index
   * If a constraint is violated, the changes need to be rolled back
   * and an error thrown
   * @param {Array.<{oldDoc: document, newDoc: document}>} pairs
   *
   * @private
   */
  updateMultipleDocs(pairs) {
    let failingIndex;
    let error;

    for (let i = 0; i < pairs.length; i += 1) {
      this.remove(pairs[i].oldDoc);
    }

    for (let i = 0; i < pairs.length; i += 1) {
      try {
        this.insert(pairs[i].newDoc);
      } catch (e) {
        error = e;
        failingIndex = i;
        break;
      }
    }

    // If an error was raised, roll back changes in the inverse order
    if (error) {
      for (let i = 0; i < failingIndex; i += 1) {
        this.remove(pairs[i].newDoc);
      }

      for (let i = 0; i < pairs.length; i += 1) {
        this.insert(pairs[i].oldDoc);
      }

      throw error;
    }
  }

  /**
   * Revert an update
   * @param {document|Array.<{oldDoc: document, newDoc: document}>} oldDoc Document to revert to, or an `Array` of `{oldDoc, newDoc}` pairs.
   * @param {document} [newDoc] Document to revert from. If the first argument is an Array of {oldDoc, newDoc}, this second argument is ignored.
   */
  revertUpdate(oldDoc, newDoc = undefined) {
    const revert = [];

    if (!Array.isArray(oldDoc)) this.update(newDoc, oldDoc);
    else {
      oldDoc.forEach((pair) => {
        revert.push({ oldDoc: pair.newDoc, newDoc: pair.oldDoc });
      });
      this.update(revert);
    }
  }

  /**
   * Get all documents in index whose key match value (if it is a Thing) or one of the elements of value (if it is an array of Things)
   * @param {Array.<*>|*} value Value to match the key against
   * @return {document[]}
   */
  getMatching(value) {
    if (!Array.isArray(value)) return this.tree.search(value);
    else {
      const _res = {};
      const res = [];

      value.forEach((v) => {
        this.getMatching(v).forEach((doc) => {
          _res[doc._id] = doc;
        });
      });

      Object.keys(_res).forEach((_id) => {
        res.push(_res[_id]);
      });

      return res;
    }
  }

  /**
   * Get all documents in index whose key is between bounds are they are defined by query
   * Documents are sorted by key
   * @param {object} query An object with at least one matcher among $gt, $gte, $lt, $lte.
   * @param {*} [query.$gt] Greater than matcher.
   * @param {*} [query.$gte] Greater than or equal matcher.
   * @param {*} [query.$lt] Lower than matcher.
   * @param {*} [query.$lte] Lower than or equal matcher.
   * @return {document[]}
   */
  getBetweenBounds(query) {
    return this.tree.betweenBounds(query);
  }

  /**
   * Get all elements in the index
   * return {document[]}
   */
  getAll() {
    const res = [];

    this.tree.executeOnEveryNode((node) => {
      res.push(...node.data);
    });

    return res;
  }
}
