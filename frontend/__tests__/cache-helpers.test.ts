import { QueryClient } from '@tanstack/react-query';
import { upsertEntityInList, patchEntityInList, removeEntityFromList } from '../lib/cache-helpers';

describe('cache-helpers', () => {
  let qc: QueryClient;
  const key = ['test'];

  beforeEach(() => {
    qc = new QueryClient();
    qc.setQueryData(key, { items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] });
  });

  it('upserts entity at start when missing', () => {
    upsertEntityInList(qc, key, { id: 3, name: 'C' } as any, 'items', 'start');
    const data: any = qc.getQueryData(key);
    expect(data.items[0]).toMatchObject({ id: 3, name: 'C' });
    expect(data.items).toHaveLength(3);
  });

  it('patches entity when present', () => {
    patchEntityInList(qc, key, 2 as any, { name: 'B2' } as any, 'items');
    const data: any = qc.getQueryData(key);
    expect(data.items.find((e: any) => e.id === 2).name).toBe('B2');
  });

  it('removes entity by id', () => {
    removeEntityFromList(qc, key, 1 as any, 'items');
    const data: any = qc.getQueryData(key);
    expect(data.items.find((e: any) => e.id === 1)).toBeUndefined();
    expect(data.items).toHaveLength(1);
  });
});


