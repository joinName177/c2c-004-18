import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { generatePlanSet } from '../../core/plan-service';
import type { PackingItem, Suitcase } from '../../core/models';
import PlanCompare from '../components/PlanCompare.vue';

const suitcase: Suitcase = { length: 10, width: 8, height: 6, maxWeight: 10 };
const item = (index: number): PackingItem => ({
  id: `item-${index}`,
  name: index % 2 === 0 ? '相同名称' : `物品 ${index}`,
  category: '衣物',
  length: 4,
  width: 2,
  height: 2,
  weight: 1,
  priority: 1,
  mustHave: false,
});

function render(stale = false) {
  const items = Array.from({ length: 8 }, (_, index) => item(index));
  const planSet = generatePlanSet(suitcase, items);
  const wrapper = mount(PlanCompare, {
    props: { planSet, items, suitcase, selected: 'comfort', stale },
  });
  return { wrapper, planSet, items };
}

describe('PlanCompare', () => {
  it('compares each non-baseline plan against the selected baseline', () => {
    const { wrapper } = render();

    expect(wrapper.text()).toContain('精简版相对差异');
    expect(wrapper.text()).toContain('购物版相对差异');
    expect(wrapper.findAll('[data-comparison-target]')).toHaveLength(2);
  });

  it('changes baseline locally without selecting a plan or emitting item data', async () => {
    const { wrapper } = render();

    await wrapper.get('[data-testid="baseline-minimal"]').trigger('click');
    expect(wrapper.get('[data-testid="baseline-minimal"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.emitted('select')).toBeUndefined();
    expect(wrapper.emitted('focusItem')).toBeUndefined();
  });

  it('emits a removed difference with its item identity and target mode', async () => {
    const { wrapper, planSet, items } = render();
    const removedId = planSet.plans.comfort.placements.find((placement) =>
      !planSet.plans.shopping.placements.some((candidate) => candidate.itemId === placement.itemId),
    )?.itemId;

    expect(removedId).toBeTruthy();
    await wrapper.get(`[data-comparison-target="shopping"] [data-diff-item="${removedId}"]`).trigger('click');
    expect(wrapper.emitted('focusItem')?.[0]).toEqual([{ itemId: removedId, mode: 'shopping', status: 'removed' }]);
    expect(wrapper.text()).toContain('承重预留');
    expect(items.filter((entry) => entry.name === '相同名称').length).toBeGreaterThan(1);
    expect(wrapper.text()).toContain('同名 4');
  });

  it('invalidates the comparison until plans are recalculated', async () => {
    const { wrapper } = render(true);

    expect(wrapper.find('[data-testid="comparison-grid"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="comparison-stale"]').text()).toContain('旧方案差异已失效');
  });
});
