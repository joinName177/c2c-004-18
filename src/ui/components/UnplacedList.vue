<script setup lang="ts">
import { computed } from 'vue';
import type { PackingItem, PackingPlan } from '../../core/models';

const props = defineProps<{ plan: PackingPlan; items: PackingItem[]; selectedId?: string }>();
const emit = defineEmits<{ focusReason: [itemId: string] }>();

const nameCounts = computed(() => props.items.reduce((counts, item) => {
  counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  return counts;
}, new Map<string, number>()));
const nameIndexes = computed(() => {
  const seen = new Map<string, number>();
  return new Map(props.items.map((item) => {
    const index = (seen.get(item.name) ?? 0) + 1;
    seen.set(item.name, index);
    return [item.id, index];
  }));
});

function itemName(item: PackingItem): string {
  if ((nameCounts.value.get(item.name) ?? 0) < 2) return item.name;
  return `${item.name}（同名 ${nameIndexes.value.get(item.id)}）`;
}
</script>

<template>
  <section class="unplaced-panel" data-testid="unplaced-panel">
    <div class="unplaced-head">
      <div><span>NOT PACKED</span><h3>未装入原因</h3></div>
      <b>{{ plan.unplaced.length }} 件</b>
    </div>
    <p v-if="plan.unplaced.length === 0" class="unplaced-empty">当前方案没有未装入物品。</p>
    <ul v-else>
      <li v-for="entry in plan.unplaced" :key="entry.item.id">
        <button
          type="button"
          :data-unplaced-item="entry.item.id"
          :class="{ focused: selectedId === entry.item.id }"
          @click="emit('focusReason', entry.item.id)"
        >
          <strong>{{ itemName(entry.item) }}</strong>
          <span>{{ entry.reason }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
