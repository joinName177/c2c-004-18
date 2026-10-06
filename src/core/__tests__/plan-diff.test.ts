import { describe, expect, it } from 'vitest';
import { comparePlans } from '../plan-diff';
import type { PackingItem, PackingPlan, Placement, PlanMode, Suitcase } from '../models';

const suitcase: Suitcase = { length: 60, width: 40, height: 25, maxWeight: 10 };

const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({
  id, name: `物品${id}`, category: '衣物', length: 10, width: 8, height: 4, weight: 1, priority: 2, mustHave: false, ...overrides,
});
const placement = (itemId: string, at: [number, number, number], dimensions: [number, number, number] = [10, 8, 4]): Placement =>
  ({ itemId, x: at[0], y: at[1], z: at[2], dimensions: { length: dimensions[0], width: dimensions[1], height: dimensions[2] } });

function plan(id: PlanMode, placements: Placement[], unplaced: Array<{ item: PackingItem; reason: string }> = [], totalWeight = 0): PackingPlan {
  return {
    id,
    name: id === 'minimal' ? '精简版' : id === 'comfort' ? '舒适版' : '购物版',
    placements,
    unplaced,
    totalWeight,
    usedVolume: placements.reduce((sum, p) => sum + p.dimensions.length * p.dimensions.width * p.dimensions.height, 0),
    capacityRatio: 0,
  };
}

const items = [
  item('a'),
  item('b'),
  item('c'),
  item('d'),
  item('dup-1', { name: '充电线' }),
  item('dup-2', { name: '充电线' }),
];

describe('comparePlans', () => {
  it('classifies unchanged items by identity', () => {
    const baseline = plan('comfort', [placement('a', [0, 0, 0]), placement('b', [10, 0, 0])]);
    const other = plan('comfort', [placement('a', [0, 0, 0]), placement('b', [10, 0, 0])]);
    const diff = comparePlans(baseline, other, items, suitcase);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.moved).toHaveLength(0);
    expect(diff.unchanged.map((entry) => entry.itemId)).toEqual(['a', 'b']);
  });

  it('lists newly packed items and records why the baseline left them out', () => {
    const baseline = plan('comfort', [placement('a', [0, 0, 0])], [{ item: item('b'), reason: '超过当前方案空间预留' }], 1);
    const other = plan('minimal', [placement('a', [0, 0, 0]), placement('b', [10, 0, 0])], [], 2);
    const diff = comparePlans(baseline, other, items, suitcase);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]).toMatchObject({ kind: 'added', itemId: 'b', baselineReason: '超过当前方案空间预留' });
    expect(diff.added[0].otherPlacement.x).toBe(10);
    expect(diff.unchanged.map((entry) => entry.itemId)).toEqual(['a']);
  });

  it('lists items no longer packed with the other plan unplaced reason', () => {
    const baseline = plan('comfort', [placement('a', [0, 0, 0]), placement('b', [10, 0, 0])], [], 2);
    const other = plan('shopping', [placement('a', [0, 0, 0])], [{ item: item('b'), reason: '超过当前方案承重预留' }], 1);
    const diff = comparePlans(baseline, other, items, suitcase);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]).toMatchObject({ kind: 'removed', itemId: 'b', reason: '超过当前方案承重预留' });
    expect(diff.removed[0].baselinePlacement.x).toBe(10);
  });

  it('treats coordinate and orientation changes as moved', () => {
    const baseline = plan('comfort', [placement('a', [0, 0, 0], [10, 8, 4]), placement('b', [10, 0, 0])]);
    const rotated = plan('shopping', [placement('a', [0, 0, 0], [8, 10, 4]), placement('b', [10, 0, 0])]);
    const relocated = plan('shopping', [placement('a', [20, 5, 0]), placement('b', [10, 0, 0])]);
    expect(comparePlans(baseline, rotated, items, suitcase).moved.map((entry) => entry.itemId)).toEqual(['a']);
    expect(comparePlans(baseline, relocated, items, suitcase).moved.map((entry) => entry.itemId)).toEqual(['a']);
    expect(comparePlans(baseline, baseline, items, suitcase).moved).toHaveLength(0);
  });

  it('compares same-name items separately by id', () => {
    const baseline = plan('comfort', [placement('dup-1', [0, 0, 0]), placement('dup-2', [10, 0, 0])]);
    const other = plan('shopping', [placement('dup-1', [0, 0, 0])], [{ item: item('dup-2', { name: '充电线' }), reason: '超过当前方案承重预留' }]);
    const diff = comparePlans(baseline, other, items, suitcase);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].itemId).toBe('dup-2');
    expect(diff.removed[0].item.name).toBe('充电线');
    expect(diff.unchanged.map((entry) => entry.itemId)).toEqual(['dup-1']);
  });

  it('ignores items unplaced in both plans', () => {
    const baseline = plan('comfort', [placement('a', [0, 0, 0])], [{ item: item('d'), reason: '尺寸或重量无效' }]);
    const other = plan('shopping', [placement('a', [0, 0, 0])], [{ item: item('d'), reason: '尺寸或重量无效' }]);
    const diff = comparePlans(baseline, other, items, suitcase);
    expect([...diff.added, ...diff.removed, ...diff.moved, ...diff.unchanged]).toHaveLength(1);
  });

  it('reports weight margin against suitcase capacity and the change versus baseline', () => {
    const baseline = plan('comfort', [placement('a', [0, 0, 0])], [], 8.5);
    const lighter = plan('minimal', [placement('a', [0, 0, 0])], [], 5.5);
    const diff = comparePlans(baseline, lighter, items, suitcase);
    expect(diff.weightMargin).toEqual({ baseline: 1.5, other: 4.5, delta: 3 });
  });

  it('does not mutate the input plans or items', () => {
    const baseline = plan('comfort', [placement('a', [0, 0, 0]), placement('b', [10, 0, 0])], [], 2);
    const snapshot = JSON.stringify({ baseline, items });
    const other = plan('shopping', [placement('a', [0, 0, 0])], [{ item: item('b'), reason: '超过当前方案承重预留' }], 1);
    comparePlans(baseline, other, items, suitcase);
    expect(JSON.stringify({ baseline, items })).toBe(snapshot);
  });
});
