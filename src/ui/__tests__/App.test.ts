import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../App.vue';
import { LocalPlannerRepository } from '../../adapters/local-planner.repository';
import type { PackingSnapshot } from '../../core/models';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

function render(snapshot?: PackingSnapshot) {
  let printCount = 0;
  const repository = new LocalPlannerRepository(new MemoryStorage());
  if (snapshot) repository.save(snapshot);
  const wrapper = mount(App, { props: {
    repository,
    printPort: { print: () => { printCount += 1; } },
  } });
  return { wrapper, getPrintCount: () => printCount };
}

describe('Luggage planner App', () => {
  it('renders sample luggage and catches invalid dimensions', async () => {
    const { wrapper } = render();
    expect(wrapper.text()).toContain('行李箱空间规划师');
    expect(wrapper.text()).toContain('轻薄外套');
    await wrapper.get('[aria-label="行李箱长度"]').setValue('0');
    expect(wrapper.text()).toContain('行李箱长度必须大于 0');
  });

  it('adds and deletes an item', async () => {
    const { wrapper } = render();
    await wrapper.get('[aria-label="物品名称"]').setValue('新物品');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    expect(wrapper.text()).toContain('新物品');
    await wrapper.get('[aria-label="删除 新物品"]').trigger('click');
    expect(wrapper.text()).not.toContain('新物品');
  });

  it('selects a plan and highlights the same item in both projections', async () => {
    const { wrapper } = render();
    await wrapper.get('[data-plan="shopping"]').trigger('click');
    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    const jacket = wrapper.findAll('[data-item-id="jacket"]');
    expect(jacket.length).toBe(2);
    await jacket[0].trigger('click');
    expect(wrapper.findAll('[data-item-id="jacket"].selected')).toHaveLength(2);
  });

  it('focuses an unplaced reason from a shopping difference without leaving block highlights', async () => {
    const snapshot: PackingSnapshot = {
      suitcase: { length: 10, width: 8, height: 6, maxWeight: 10 },
      selectedPlan: 'comfort',
      items: [
        { id: 'same-a', name: '相同名称', category: '衣物', length: 4, width: 2, height: 2, weight: 1, priority: 1, mustHave: false },
        { id: 'same-b', name: '相同名称', category: '衣物', length: 4, width: 2, height: 2, weight: 1, priority: 1, mustHave: false },
        { id: 'same-c', name: '相同名称', category: '衣物', length: 4, width: 2, height: 2, weight: 1, priority: 1, mustHave: false },
        { id: 'heavy-a', name: '重物', category: '衣物', length: 4, width: 2, height: 2, weight: 3, priority: 1, mustHave: false },
        { id: 'heavy-b', name: '另一件重物', category: '衣物', length: 4, width: 2, height: 2, weight: 3, priority: 1, mustHave: false },
      ],
    };
    const { wrapper } = render(snapshot);
    const removedId = wrapper.get('[data-comparison-target="shopping"] .diff-row.removed').attributes('data-diff-item');

    await wrapper.get(`[data-comparison-target="shopping"] [data-diff-item="${removedId}"]`).trigger('click');

    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    expect(wrapper.get(`[data-unplaced-item="${removedId}"]`).classes()).toContain('focused');
    expect(wrapper.findAll('.projection button.selected')).toHaveLength(0);
  });

  it('hides old differences after inventory changes and shows them after recalculation', async () => {
    const { wrapper } = render();

    expect(wrapper.find('[data-testid="comparison-grid"]').exists()).toBe(true);
    await wrapper.get('[aria-label="物品名称"]').setValue('新物品');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');

    expect(wrapper.find('[data-testid="comparison-grid"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="comparison-stale"]').text()).toContain('重新计算');

    await wrapper.get('.header-actions .primary').trigger('click');
    expect(wrapper.find('[data-testid="comparison-grid"]').exists()).toBe(true);
  });

  it('delegates printing through the print port', async () => {
    const { wrapper, getPrintCount } = render();
    await wrapper.get('[data-testid="print-button"]').trigger('click');
    expect(getPrintCount()).toBe(1);
  });
});
