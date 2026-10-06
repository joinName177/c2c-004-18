import { describe, expect, it } from 'vitest';
import { generatePlanSet } from '../plan-service';
import { comparePlans } from '../plan-diff';
import type { PackingItem, PackingPlan, PlanMode, Suitcase } from '../models';

const box: Suitcase = { length: 10, width: 8, height: 6, maxWeight: 10 };
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({
  id, name: id, category: '衣物', length: 4, width: 2, height: 2, weight: 1, priority: 1, mustHave: false, ...overrides,
});

describe('comparePlans', () => {
  it('identifies added, removed and moved items by item identity', () => {
    const generationId = 'same-generation';
    const items = ['added', 'removed', 'moved', 'same'].map((id) => item(id, { name: '相同名称' }));
    const plan = (id: PlanMode, placementItems: Record<string, [number, number, number]>, unplaced: Array<{ item: PackingItem; reason: string }> = []): PackingPlan => ({
      id,
      name: id,
      generationId,
      placements: Object.entries(placementItems).map(([itemId, [x, y, z]]) => ({
        itemId: itemId,
        x,
        y,
        z,
        dimensions: { length: 4, width: 2, height: 2 },
      })),
      unplaced,
      totalWeight: 2,
      weightLimit: 3,
      usedVolume: 16,
      capacityRatio: 0.1,
    });
    const baseline = plan('comfort', { removed: [0, 0, 0], moved: [0, 2, 0], same: [4, 0, 0] });
    const target = plan('shopping', { added: [0, 0, 0], moved: [4, 2, 0], same: [4, 0, 0] }, [
      { item: items[1], reason: '超过当前方案承重预留' },
    ]);

    const diff = comparePlans(baseline, target, items, box, generationId);

    expect(diff.counts).toEqual({ added: 1, removed: 1, moved: 1 });
    expect(diff.items.map(({ status }) => status)).toContain('added');
    expect(diff.items.find((entry) => entry.item.id === 'removed')?.targetReason).toContain('承重预留');
  });

  it('reports physical weight margin changes', () => {
    const generationId = 'weight-generation';
    const makePlan = (id: PlanMode, totalWeight: number): PackingPlan => ({
      id,
      name: id,
      generationId,
      placements: [],
      unplaced: [],
      totalWeight,
      weightLimit: id === 'shopping' ? 6.5 : 10,
      usedVolume: 0,
      capacityRatio: 0,
    });

    const diff = comparePlans(makePlan('comfort', 2), makePlan('shopping', 5.5), [], box, generationId);

    expect(diff.baselineWeightMargin).toBeCloseTo(8);
    expect(diff.targetWeightMargin).toBeCloseTo(4.5);
    expect(diff.weightMarginDelta).toBeCloseTo(-3.5);
  });

  it('rejects plans from different calculations', () => {
    const first = generatePlanSet(box, [item('a')]);
    const second = generatePlanSet(box, [item('a')]);

    expect(() => comparePlans(first.plans.comfort, second.plans.shopping, [item('a')], box, first.generationId)).toThrow('同一次计算');
  });
});
