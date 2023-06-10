import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

import { type PersistenceOptionsProps } from './types/datastore';

const fsPromises = fs.promises;

const DEFAULT_DIR_MODE = 0o755;
const DEFAULT_FILE_MODE = 0o644;
/**
 * Way data is stored for this database.
 * This version is the Node.js/Node Webkit version.
 * It's essentially fs, mkdirp and crash safe write and read functions.
 *
 * @see module:storageBrowser
 * @see module:storageReactNative
 * @module storage
 * @private
 */
/**
 * Returns true if file exists.
 * @param {string} file
 * @return {Promise<boolean>}
 * @async
 * @alias module:storage.existsAsync
 * @see module:storage.exists
 */
export const existsAsync = (file) =>
  fsPromises.access(file, fs.constants.F_OK).then(
    () => true,
    () => false,
  );

/**
 * Node.js' [fsPromises.rename]{@link https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath}
 * @function
 * @param {string} oldPath
 * @param {string} newPath
 * @return {Promise<void>}
 * @alias module:storage.renameAsync
 * @async
 */
export const renameAsync = fsPromises.rename;

/**
 * Node.js' [fsPromises.writeFile]{@link https://nodejs.org/api/fs.html#fspromiseswritefilefile-data-options}.
 * @function
 * @param {string} path
 * @param {string} data
 * @param {object} [options]
 * @return {Promise<void>}
 * @alias module:storage.writeFileAsync
 * @async
 */
export const writeFileAsync = fsPromises.writeFile;

/**
 * Node.js' [fs.createWriteStream]{@link https://nodejs.org/api/fs.html#fscreatewritestreampath-options}.
 * @function
 * @param {string} path
 * @param {Object} [options]
 * @return {fs.WriteStream}
 * @alias module:storage.writeFileStream
 */
const writeFileStream = fs.createWriteStream;

/**
 * Node.js' [fsPromises.unlink]{@link https://nodejs.org/api/fs.html#fspromisesunlinkpath}.
 * @function
 * @param {string} path
 * @return {Promise<void>}
 * @async
 * @alias module:storage.unlinkAsync
 */
export const unlinkAsync = fsPromises.unlink;

/**
 * Node.js' [fsPromises.appendFile]{@link https://nodejs.org/api/fs.html#fspromisesappendfilepath-data-options}.
 * @function
 * @param {string} path
 * @param {string} data
 * @param {object} [options]
 * @return {Promise<void>}
 * @alias module:storage.appendFileAsync
 * @async
 */
export const appendFileAsync = fsPromises.appendFile;

/**
 * Node.js' [fsPromises.readFile]{@link https://nodejs.org/api/fs.html#fspromisesreadfilepath-options}.
 * @function
 * @param {string} path
 * @param {object} [options]
 * @return {Promise<Buffer>}
 * @alias module:storage.readFileAsync
 * @async
 */
export const readFileAsync = fsPromises.readFile;

/**
 * Node.js' [fs.createReadStream]{@link https://nodejs.org/api/fs.html#fscreatereadstreampath-options}.
 * @function
 * @param {string} path
 * @param {Object} [options]
 * @return {fs.ReadStream}
 * @alias module:storage.readFileStream
 */
export const readFileStream = fs.createReadStream;

/**
 * Node.js' [fsPromises.mkdir]{@link https://nodejs.org/api/fs.html#fspromisesmkdirpath-options}.
 * @function
 * @param {string} path
 * @param {object} options
 * @return {Promise<void|string>}
 * @alias module:storage.mkdirAsync
 * @async
 */
export const mkdirAsync = fsPromises.mkdir;

/**
 * Removes file if it exists.
 * @param {string} file
 * @return {Promise<void>}
 * @alias module:storage.ensureFileDoesntExistAsync
 * @async
 */
export const ensureFileDoesntExistAsync = async (file) => {
  if (await existsAsync(file)) await unlinkAsync(file);
};

/**
 * Flush data in OS buffer to storage if corresponding option is set.
 * @param {object|string} options If options is a string, it is assumed that the flush of the file (not dir) called options was requested
 * @param {string} [options.filename]
 * @param {boolean} [options.isDir = false] Optional, defaults to false
 * @param {number} [options.mode = 0o644] Optional, defaults to 0o644
 * @return {Promise<void>}
 * @alias module:storage.flushToStorageAsync
 * @async
 */
export const flushToStorageAsync = async (options) => {
  let filename;
  let flags;
  let mode;
  if (typeof options === 'string') {
    filename = options;
    flags = 'r+';
    mode = DEFAULT_FILE_MODE;
  } else {
    filename = options.filename;
    flags = options.isDir ? 'r' : 'r+';
    mode = options.mode !== undefined ? options.mode : DEFAULT_FILE_MODE;
  }
  /**
   * Some OSes and/or storage backends (augmented node fs) do not support fsync (FlushFileBuffers) directories,
   * or calling open() on directories at all. Flushing fails silently in this case, supported by following heuristics:
   *  + isDir === true
   *  |-- open(<dir>) -> (err.code === 'EISDIR'): can't call open() on directories (eg. BrowserFS)
   *  `-- fsync(<dir>) -> (errFS.code === 'EPERM' || errFS.code === 'EISDIR'): can't fsync directory: permissions are checked
   *        on open(); EPERM error should only occur on fsync incapability and not for general lack of permissions (e.g. Windows)
   *
   * We can live with this as it cannot cause 100% dataloss except in the very rare event of the first time
   * database is loaded and a crash happens.
   */

  let filehandle;
  let errorOnFsync;
  let errorOnClose;
  try {
    filehandle = await fsPromises.open(filename, flags, mode);
    try {
      await filehandle.sync();
    } catch (errFS) {
      errorOnFsync = errFS;
    }
  } catch (error) {
    if (error.code !== 'EISDIR' || !options.isDir) throw error;
  } finally {
    try {
      await filehandle.close();
    } catch (errC) {
      errorOnClose = errC;
    }
  }
  if (
    (errorOnFsync || errorOnClose) &&
    !(
      (errorOnFsync.code === 'EPERM' || errorOnClose.code === 'EISDIR') &&
      options.isDir
    )
  ) {
    const e = new Error('Failed to flush to storage');
    e['errorOnFsync'] = errorOnFsync;
    e['errorOnClose'] = errorOnClose;
    throw e;
  }
};

/**
 * Fully write or rewrite the datafile.
 * @param {string} filename
 * @param {string[]} lines
 * @param {number} [mode=0o644]
 * @return {Promise<void>}
 * @alias module:storage.writeFileLinesAsync
 * @async
 */
export const writeFileLinesAsync = (
  filename,
  lines,
  mode = DEFAULT_FILE_MODE,
) =>
  new Promise((resolve, reject) => {
    try {
      const stream = writeFileStream(filename, { mode: mode });
      const readable = Readable.from(lines);
      readable.on('data', (line) => {
        try {
          stream.write(line + '\n');
        } catch (err) {
          reject(err);
        }
      });
      readable.on('end', () => {
        stream.close((err) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });

      readable.on('error', (err) => {
        reject(err);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });

/**
 * ✨ Fully write or rewrite the datafile, immune to crashes during the write operation (data will not be lost).
 * - [I finished rewriting the crash safe write function, mimicing how Redis AOF basically works](https://github.com/louischatriot/nedb/issues/265)
 * - this code doesn't work on Windows, as it seems that Windows's counterpart to `fsync`, `FlushFileBuffers` cannot be called on directories.
 * @param {string} filename
 * @param {string[]} lines
 * @param {object} [modes={ fileMode: 0o644, dirMode: 0o755 }]
 * @param {number} modes.dirMode
 * @param {number} modes.fileMode
 * @return {Promise<void>}
 * @alias module:storage.crashSafeWriteFileLinesAsync
 */
export const crashSafeWriteFileLinesAsync = async (
  filename,
  lines,
  modes: PersistenceOptionsProps['modes'] = {
    fileMode: DEFAULT_FILE_MODE,
    dirMode: DEFAULT_DIR_MODE,
  },
) => {
  /** temporary file suffix with `~`  */
  const tempFilename = filename + '~';

  // 1. fsync directory so that datafile is sure to be linked to from the directory
  await flushToStorageAsync({
    filename: path.dirname(filename),
    isDir: true,
    mode: modes.dirMode,
  });

  // 2. fsync datafile if it exists. At this point we are guaranteed that datafile is up to date, and a crash during steps 1 or 2 will not corrupt the datafile
  const exists = await existsAsync(filename);
  if (exists) await flushToStorageAsync({ filename, mode: modes.fileMode });

  // 3. Write data to a temp datafile, then fsync it
  await writeFileLinesAsync(tempFilename, lines, modes.fileMode);
  await flushToStorageAsync({ filename: tempFilename, mode: modes.fileMode });

  // 4. Rename temp datafile to datafile and fsync directory
  await renameAsync(tempFilename, filename);
  await flushToStorageAsync({
    filename: path.dirname(filename),
    isDir: true,
    mode: modes.dirMode,
  });
};

/**
 * Ensure the datafile contains all the data, even if there was a crash during a full file write.
 * @param {string} filename
 * @param {number} [mode=0o644]
 * @return {Promise<void>}
 * @alias module:storage.ensureDatafileIntegrityAsync
 */
export const ensureDatafileIntegrityAsync = async (
  filename,
  mode = DEFAULT_FILE_MODE,
) => {
  const tempFilename = filename + '~';

  const filenameExists = await existsAsync(filename);
  // Write was successful
  if (filenameExists) return;

  const oldFilenameExists = await existsAsync(tempFilename);
  // New database
  if (!oldFilenameExists)
    await writeFileAsync(filename, '', { encoding: 'utf8', mode });
  // Write failed, use old version
  else await renameAsync(tempFilename, filename);
};
