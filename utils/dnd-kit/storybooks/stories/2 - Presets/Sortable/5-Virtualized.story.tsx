import React, {useState} from 'react';
import {createPortal} from 'react-dom';
import VirtualList from 'react-tiny-virtual-list';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {Item, Wrapper} from '../../components';
import {createRange} from '../../utilities';
import {SortableItem, type SortableProps} from './Sortable';
import styles from './Virtualized.module.css';

export default {
  title: 'Presets/Sortable/Virtualized',
};

function Sortable({
  adjustScale = false,
  strategy = verticalListSortingStrategy,
  itemCount = 100,
  handle = false,
  getItemStyles = () => ({}),
  modifiers,
}: SortableProps) {
  const [items, setItems] = useState(() =>
    createRange<string>(itemCount, (index) => `${index + 1}`)
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      // Disable smooth scrolling in Cypress automated tests
      scrollBehavior: 'Cypress' in window ? 'auto' : undefined,
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const getIndex: (id: string) => number = items.indexOf.bind(items);
  const activeIndex = activeId ? getIndex(activeId) : -1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({active}) => {
        setActiveId(active.id);
      }}
      onDragEnd={({over}) => {
        if (over) {
          const overIndex = getIndex(over.id);
          if (activeIndex !== overIndex) {
            setItems((items) => arrayMove(items, activeIndex, overIndex));
          }
        }

        setActiveId(null);
      }}
      onDragCancel={() => setActiveId(null)}
      modifiers={modifiers}
    >
      <Wrapper center>
        <SortableContext items={items} strategy={strategy}>
          <VirtualList
            width={500}
            height={600}
            className={styles.VirtualList}
            itemCount={items.length}
            itemSize={64}
            stickyIndices={activeId ? [items.indexOf(activeId)] : undefined}
            renderItem={({index, style}) => {
              const id = items[index];

              return (
                <SortableItem
                  key={id}
                  id={id}
                  index={index}
                  handle={handle}
                  wrapperStyle={() => ({
                    ...style,
                    padding: 5,
                  })}
                  style={getItemStyles}
                  useDragOverlay
                />
              );
            }}
          />
        </SortableContext>
      </Wrapper>
      {createPortal(
        <DragOverlay adjustScale={adjustScale}>
          {activeId ? (
            <Item
              value={items[activeIndex]}
              handle={handle}
              style={getItemStyles({
                id: activeId,
                index: activeIndex,
                isDragging: true,
                isSorting: true,
                overIndex: -1,
                isDragOverlay: true,
              })}
              wrapperStyle={{
                padding: 5,
              }}
              dragOverlay
            />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}

const props = {
  strategy: verticalListSortingStrategy,
};

export const BasicSetup = () => <Sortable {...props} />;
