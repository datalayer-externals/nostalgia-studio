import React, { useCallback } from 'react';

import cx from 'classnames';

import { deleteSyncMapById } from '@logux/client';
import { useClient, useFilter } from '@logux/client/react';
import { useStore } from '@nanostores/react';

import { authStore } from '../../stores/auth';
import { Filter, filterStore } from '../../stores/filter';
import { tasksStore } from '../../stores/tasks';
import styles from './ControlPanel.module.css';

export const ControlPanel = (): JSX.Element => {
  const client = useClient();
  const filter = useStore(filterStore);
  const { id: authorId } = useStore(authStore);
  const tasks = useFilter(tasksStore, { authorId });
  const activeTasksCount = tasks.list.filter((task) => !task.completed).length;

  const handleClearCompletedClick = useCallback(() => {
    const tasksToDelete = tasks.list.filter((task) => task.completed);

    tasksToDelete.forEach((task) =>
      deleteSyncMapById(client, tasksStore, task.id),
    );
  }, [client, tasks]);

  return (
    <footer className={styles.controlPanel}>
      <span className={styles.itemsCount}>{activeTasksCount} items left</span>
      <ul className={styles.filters}>
        <li className={styles.filtersItem}>
          <button
            type='button'
            className={cx(
              styles.filtersItemContent,
              filter === Filter.all && styles.filtersItemContentSelected,
            )}
            onClick={() => {
              filterStore.set(Filter.all);
            }}
          >
            All
          </button>
        </li>
        <li className={styles.filtersItem}>
          <button
            type='button'
            className={cx(
              styles.filtersItemContent,
              filter === Filter.active && styles.filtersItemContentSelected,
            )}
            onClick={() => {
              filterStore.set(Filter.active);
            }}
          >
            Active
          </button>
        </li>
        <li className={styles.filtersItem}>
          <button
            type='button'
            className={cx(
              styles.filtersItemContent,
              filter === Filter.completed && styles.filtersItemContentSelected,
            )}
            onClick={() => {
              filterStore.set(Filter.completed);
            }}
          >
            Completed
          </button>
        </li>
      </ul>
      <button
        type='button'
        className={styles.clearAction}
        onClick={handleClearCompletedClick}
      >
        Clear completed
      </button>
    </footer>
  );
};
