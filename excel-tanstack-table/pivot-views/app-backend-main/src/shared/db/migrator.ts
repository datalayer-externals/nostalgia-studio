import { fileURLToPath } from 'node:url';

import fs from 'fs';
import path from 'path';
import { SequelizeStorage, Umzug } from 'umzug';

import { Connection } from '.';
import logger from '../../shared/logger';
import { __dirname } from '../../utils';

// export const __filename = fileURLToPath(import.meta.url);
// export const __dirname = dirname(__filename);

export const createMigrator = () => {
  if (!Connection.initialized) {
    Connection.init();
  }
  const sequelize = Connection.db;
  const migrator = new Umzug({
    create: {
      folder: path.resolve(__dirname, 'migrations'),
      template: (filePath) => [
        [
          filePath,
          fs.readFileSync(path.resolve(__dirname, 'template.ts')).toString(),
        ],
      ],
    },
    migrations: {
      glob: ['migrations/*.{ts,up.sql}', { cwd: __dirname }],
      resolve: (params) => {
        if (params.path && !params.path.endsWith('.sql')) {
          return Umzug.defaultResolver(params);
        }
        const { context: sequelize } = params;
        const ppath = params.path as string;
        return {
          name: params.name,
          up: async () => {
            const sql = fs.readFileSync(ppath).toString();
            return sequelize.query(sql);
          },
          down: async () => {
            // Get the corresponding `.down.sql` file to undo this migration
            const sql = fs
              .readFileSync(ppath.replace('.up.sql', '.down.sql'))
              .toString();
            return sequelize.query(sql);
          },
        };
      },
    },
    context: sequelize,
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  // todo fix
  // if (require.main === module) {
  if (process.argv[1] === fileURLToPath(import.meta.url)) {
    migrator.runAsCLI();
  }

  return migrator;
};
export async function checkMigrations(): Promise<boolean> {
  const migrator = createMigrator();
  const pending = await migrator.pending();
  if (pending.length > 0) {
    logger.info('Pending migrations', pending);
    try {
      const result = await migrator.up();
      logger.info('Migrations applied', result);
    } catch (e: unknown) {
      logger.error('Migration failed, reverting...', e);
      const down = await migrator.down();
      logger.info('Migrations reverted', down);
      return false;
    }
  }
  return true;
}

// CLI
export default createMigrator();
