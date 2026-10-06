import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { PackingItem, PackingPlan } from '../../core/models';
import UnplacedList from '../components/UnplacedList.vue';

const item = (id: string, name: string): PackingItem => ({ id, name, category: '衣物', length: 1, width: 1, height: 1, weight: 1, priority: 1, mustHave: false });
const plan: PackingPlan = {
  id: 'shopping',
  name: '购物版',
  placements: [],
  unplaced: [
    { item: item('first', '相同名称'), reason: '第一个未装原因' },
    { item: item('second', '相同名称'), reason: '第二个未装原因' },
  ],
  totalWeight: 0,
  weightLimit: 6.5,
  usedVolume: 0,
  capacityRatio: 0,
};

describe('UnplacedList', () => {
  it('separates duplicate names and emits the selected item identity', async () => {
    const wrapper = mount(UnplacedList, { props: { plan, items: plan.unplaced.map(({ item }) => item), selectedId: 'second' } });

    expect(wrapper.text()).toContain('相同名称（同名 1）');
    expect(wrapper.text()).toContain('相同名称（同名 2）');
    expect(wrapper.get('[data-unplaced-item="second"]').classes()).toContain('focused');

    await wrapper.get('[data-unplaced-item="first"]').trigger('click');
    expect(wrapper.emitted('focusReason')).toEqual([['first']]);
  });
});
