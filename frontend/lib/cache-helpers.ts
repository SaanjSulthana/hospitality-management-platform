import { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Utilities to update list-shaped query data in a safe, verbose, and explicit way.
 * These helpers support either:
 * - a plain array of entities, or
 * - an object that contains the list under a known key (e.g., { revenues: Entity[] }).
 *
 * You must pass the containerKey when the list is nested (e.g., 'revenues', 'expenses').
 */

export interface IdentifiableEntity {
  id: string | number;
  // Other properties are allowed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function getListFromContainer<T extends IdentifiableEntity>(
  containerOrArray: T[] | Record<string, unknown> | undefined,
  containerKey?: string
): T[] | undefined {
  if (!containerOrArray) return undefined;
  if (Array.isArray(containerOrArray)) return containerOrArray as T[];
  if (containerKey && typeof containerOrArray === 'object') {
    const maybe = (containerOrArray as Record<string, unknown>)[containerKey];
    return Array.isArray(maybe) ? (maybe as T[]) : undefined;
  }
  return undefined;
}

function setListOnContainer<T extends IdentifiableEntity>(
  containerOrArray: T[] | Record<string, unknown>,
  newList: T[],
  containerKey?: string
): T[] | Record<string, unknown> {
  if (Array.isArray(containerOrArray)) {
    return newList;
  }
  if (containerKey && typeof containerOrArray === 'object') {
    return { ...(containerOrArray as Record<string, unknown>), [containerKey]: newList };
  }
  return containerOrArray;
}

export function upsertEntityInList<T extends IdentifiableEntity>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  entity: T,
  containerKey?: string,
  insertAt: 'start' | 'end' = 'start'
): void {
  queryClient.setQueryData(queryKey, (oldData: any) => {
    const list = getListFromContainer<T>(oldData, containerKey);
    if (!list) return oldData;
    const index = list.findIndex((e) => String(e.id) === String(entity.id));
    let newList: T[];
    if (index >= 0) {
      newList = list.map((e, i) => (i === index ? { ...e, ...entity } : e));
    } else {
      newList = insertAt === 'start' ? [entity as T, ...list] : [...list, entity as T];
    }
    return setListOnContainer<T>(oldData, newList, containerKey);
  });
}

export function patchEntityInList<T extends IdentifiableEntity>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  entityId: T['id'],
  updates: Partial<T>,
  containerKey?: string
): void {
  queryClient.setQueryData(queryKey, (oldData: any) => {
    const list = getListFromContainer<T>(oldData, containerKey);
    if (!list) return oldData;
    const newList = list.map((e) => (String(e.id) === String(entityId) ? ({ ...e, ...updates } as T) : e));
    return setListOnContainer<T>(oldData, newList, containerKey);
  });
}

export function removeEntityFromList<T extends IdentifiableEntity>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  entityId: T['id'],
  containerKey?: string
): void {
  queryClient.setQueryData(queryKey, (oldData: any) => {
    const list = getListFromContainer<T>(oldData, containerKey);
    if (!list) return oldData;
    const newList = list.filter((e) => String(e.id) !== String(entityId));
    return setListOnContainer<T>(oldData, newList, containerKey);
  });
}


