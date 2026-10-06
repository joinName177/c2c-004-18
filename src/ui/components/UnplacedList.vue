<script setup lang="ts">
import type { PackingPlan } from '../../core/models';
defineProps<{ plan: PackingPlan; selectedId?: string }>();
const emit = defineEmits<{ locate: [id: string] }>();
</script>

<template>
  <section v-if="plan.unplaced.length" class="unplaced-list" data-testid="unplaced-list">
    <div class="unplaced-head"><span>UNPACKED REASONS</span><b>{{ plan.unplaced.length }} 件未装入 · 点击查看原因</b></div>
    <button
      v-for="entry in plan.unplaced"
      :key="entry.item.id"
      type="button"
      class="unplaced-row"
      :class="{ selected: entry.item.id === selectedId }"
      :data-unplaced-id="entry.item.id"
      @click="emit('locate', entry.item.id)"
    >
      <strong>{{ entry.item.name }}</strong>
      <span>{{ entry.reason }}</span>
    </button>
  </section>
</template>
