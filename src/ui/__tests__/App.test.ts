import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../App.vue';
import { LocalPlannerRepository } from '../../adapters/local-planner.repository';
import type { PackingSnapshot } from '../../core/models';

const STORAGE_KEY = 'c2c-004.planner';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: string | number) { return [...this.data.keys()][index as number] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

function customSnapshot(): PackingSnapshot {
  return {
    suitcase: { length: 20, width: 10, height: 5, maxWeight: 10 },
    selectedPlan: 'comfort',
    items: [
      { id: 'a', name: '物品甲', category: '其他', length: 10, width: 5, height: 2, weight: 3, priority: 1, mustHave: false },
      { id: 'b', name: '物品乙', category: '其他', length: 10, width: 5, height: 2, weight: 2, priority: 1, mustHave: false },
      { id: 'c', name: '物品丙', category: '其他', length: 10, width: 5, height: 2, weight: 3, priority: 1, mustHave: false },
      { id: 'm', name: '必带物', category: '其他', length: 5, width: 4, height: 2, weight: 0.5, priority: 3, mustHave: true },
    ],
  };
}

function render(snapshot?: PackingSnapshot) {
  let printCount = 0;
  const storage = new MemoryStorage();
  if (snapshot) storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  const wrapper = mount(App, {
    attachTo: document.body,
    props: {
      repository: new LocalPlannerRepository(storage),
      printPort: { print: () => { printCount += 1; } },
    },
  });
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
    const jacket = wrapper.findAll('.projection [data-item-id="jacket"]');
    expect(jacket.length).toBe(2);
    await jacket[0].trigger('click');
    expect(wrapper.findAll('.projection [data-item-id="jacket"].selected')).toHaveLength(2);
  });

  it('delegates printing through the print port', async () => {
    const { wrapper, getPrintCount } = render();
    await wrapper.get('[data-testid="print-button"]').trigger('click');
    expect(getPrintCount()).toBe(1);
  });

  it('shows per-item differences against a selectable baseline with margin change and reasons', () => {
    const { wrapper } = render(customSnapshot());
    const panel = wrapper.get('[data-testid="plan-diff"]');
    expect(panel.text()).toContain('方案差异对比');
    expect(panel.get('[data-testid="diff-count-minimal"]').text()).toBe('1');
    expect(panel.get('[data-testid="diff-count-shopping"]').text()).toBe('3');
    const minimalCard = panel.get('[data-diff-mode="minimal"]');
    expect(minimalCard.text()).toContain('物品丙');
    expect(minimalCard.text()).toContain('未再装入');
    expect(minimalCard.text()).toContain('超过当前方案承重预留');
    expect(panel.get('[data-testid="margin-minimal"]').text()).toContain('1.5kg → 4.5kg');
    expect(panel.get('[data-testid="margin-minimal"]').text()).toContain('+3.0kg');
    const shoppingCard = panel.get('[data-diff-mode="shopping"]');
    expect(shoppingCard.text()).toContain('位置改变');
    // 同名物品由身份区分：两条位置改变分别属于 a、b
    expect(shoppingCard.findAll('[data-diff-kind="moved"]').map((row) => row.attributes('data-item-id'))).toEqual(['a', 'b']);
  });

  it('clicking a removed diff switches plan, locates the reason row and keeps no block highlight', async () => {
    const { wrapper } = render(customSnapshot());
    // 先在基准（舒适版）中选中 m，制造一个既有色块高亮
    await wrapper.findAll('.projection [data-item-id="m"]')[0].trigger('click');
    expect(wrapper.findAll('.projection [data-item-id="m"].selected')).toHaveLength(2);
    // 点击精简版卡片中的“物品丙 未再装入”
    await wrapper.get('[data-diff-mode="minimal"] [data-item-id="c"]').trigger('click');
    expect(wrapper.get('[data-plan="minimal"]').classes()).toContain('active');
    expect(wrapper.get('[data-testid="unplaced-list"]').text()).toContain('物品丙');
    expect(wrapper.get('[data-unplaced-id="c"]').classes()).toContain('selected');
    // 未装入物品在精简版没有色块，上一个 m 的高亮也不得保留
    expect(wrapper.findAll('.projection [data-item-id="m"].selected')).toHaveLength(0);
    expect(wrapper.findAll('.projection [data-item-id="c"]')).toHaveLength(0);
  });

  it('clicking a moved diff switches plan and highlights the blocks in both projections', async () => {
    const { wrapper } = render(customSnapshot());
    await wrapper.get('[data-diff-mode="shopping"] [data-item-id="a"]').trigger('click');
    expect(wrapper.get('[data-plan="shopping"]').classes()).toContain('active');
    expect(wrapper.findAll('.projection [data-item-id="a"].selected')).toHaveLength(2);
  });

  it('locates an added item after changing the baseline', async () => {
    const { wrapper } = render(customSnapshot());
    // 基准切到精简版：舒适版卡片中 c 是“新增装入”，并展示基准未装原因
    const baselineButtons = wrapper.findAll('.baseline-tabs button');
    await baselineButtons[0].trigger('click');
    const comfortCard = wrapper.get('[data-diff-mode="comfort"]');
    const addedRow = comfortCard.get('[data-diff-kind="added"][data-item-id="c"]');
    expect(addedRow.text()).toContain('新增装入');
    expect(addedRow.text()).toContain('超过当前方案承重预留');
    await addedRow.trigger('click');
    expect(wrapper.get('[data-plan="comfort"]').classes()).toContain('active');
    expect(wrapper.findAll('.projection [data-item-id="c"].selected')).toHaveLength(2);
  });

  it('invalidates the old comparison until all three plans are recalculated', async () => {
    const { wrapper } = render(customSnapshot());
    expect(wrapper.find('[data-testid="diff-stale"]').exists()).toBe(false);
    await wrapper.get('[aria-label="物品名称"]').setValue('帽子');
    await wrapper.get('[data-testid="item-editor"]').trigger('submit');
    const stale = wrapper.get('[data-testid="diff-stale"]');
    expect(stale.text()).toContain('方案对比已失效');
    // 失效期间不再展示任何差异卡片
    expect(wrapper.find('[data-diff-mode="minimal"]').exists()).toBe(false);
    await wrapper.get('button.primary').trigger('click');
    expect(wrapper.find('[data-testid="diff-stale"]').exists()).toBe(false);
    expect(wrapper.find('[data-diff-mode="minimal"]').exists()).toBe(true);
  });
});
