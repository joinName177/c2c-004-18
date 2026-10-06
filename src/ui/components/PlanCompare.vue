<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { comparePlanSet } from '../../core/plan-diff';
import type { GeneratedPlanSet, PackingItem, PlanComparison, PlanDiffStatus, PlanMode, Placement, Suitcase } from '../../core/models';

const props = defineProps<{
  planSet: GeneratedPlanSet;
  items: PackingItem[];
  suitcase: Suitcase;
  selected: PlanMode;
  stale: boolean;
}>();
const emit = defineEmits<{
  select: [mode: PlanMode];
  focusItem: [payload: { itemId: string; mode: PlanMode; status: PlanDiffStatus }];
}>();

const baseline = ref<PlanMode>('comfort');
watch(() => props.planSet.generationId, () => { baseline.value = 'comfort'; });

const modeOrder: PlanMode[] = ['minimal', 'comfort', 'shopping'];
const eyebrow: Record<PlanMode, string> = { minimal: 'LIGHT', comfort: 'BALANCED', shopping: 'RESERVE' };
const statusLabel: Record<PlanDiffStatus, string> = { added: '新增装入', removed: '未再装入', moved: '位置改变' };

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

const comparisons = computed<PlanComparison[]>(() => {
  if (props.stale) return [];
  return modeOrder
    .filter((mode) => mode !== baseline.value)
    .map((mode) => comparePlanSet(props.planSet.plans, baseline.value, mode, props.items, props.suitcase, props.planSet.generationId));
});

function setBaseline(mode: PlanMode) {
  baseline.value = mode;
}

function itemName(item: PackingItem): string {
  const count = nameCounts.value.get(item.name) ?? 1;
  if (count === 1) return item.name;
  return `${item.name}（同名 ${nameIndexes.value.get(item.id)}）`;
}

function placementText(placement: Placement): string {
  return `(${placement.x}, ${placement.y}, ${placement.z}) · ${placement.dimensions.length}×${placement.dimensions.width}×${placement.dimensions.height}cm`;
}

function positionText(diff: PlanComparison['items'][number]): string {
  if (diff.status === 'added') {
    return `基准未装：${diff.baselineReason ?? '未装入'}；当前 ${diff.targetPlacement ? placementText(diff.targetPlacement) : '未装入'}`;
  }
  if (diff.status === 'removed') {
    return `基准 ${diff.baselinePlacement ? placementText(diff.baselinePlacement) : '未装入'}；当前未装：${diff.targetReason ?? '未装入'}`;
  }
  if (diff.baselinePlacement && diff.targetPlacement) {
    return `基准 ${placementText(diff.baselinePlacement)} → 当前 ${placementText(diff.targetPlacement)}`;
  }
  return '';
}

function marginText(value: number): string {
  return `${Math.max(0, value).toFixed(1)}kg`;
}

function deltaText(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}kg`;
}

function focusDiff(diff: PlanComparison['items'][number], targetId: PlanMode) {
  emit('focusItem', { itemId: diff.item.id, mode: targetId, status: diff.status });
}
</script>

<template>
  <section class="plan-compare" data-testid="plan-compare">
    <div class="plan-tabs">
      <div
        v-for="plan in modeOrder.map((mode) => planSet.plans[mode])"
        :key="plan.id"
        class="plan-card"
        :data-plan-card="plan.id"
        :class="{ active: plan.id === selected }"
      >
        <button
          type="button"
          class="plan-select"
          :data-plan="plan.id"
          :class="{ active: plan.id === selected }"
          @click="emit('select', plan.id)"
        >
          <span>{{ eyebrow[plan.id] }}</span>
          <strong>{{ plan.name }}</strong>
          <small>{{ plan.placements.length }} 件 · {{ Math.round(plan.capacityRatio * 100) }}% 空间 · {{ plan.totalWeight.toFixed(1) }}/{{ suitcase.maxWeight }}kg</small>
        </button>
        <button
          type="button"
          class="baseline-button"
          :class="{ selected: baseline === plan.id }"
          :data-testid="`baseline-${plan.id}`"
          :aria-pressed="baseline === plan.id"
          @click.stop="setBaseline(plan.id)"
        >{{ baseline === plan.id ? '✓ 对比基准' : '设为基准' }}</button>
      </div>
    </div>

    <div v-if="stale" class="comparison-stale" data-testid="comparison-stale" role="status">
      <strong>清单或箱体已调整，旧方案差异已失效</strong>
      <p>点击“智能装箱”重新计算三套结果后，才会展示新增、未再装入和位置改变的物品。</p>
    </div>

    <div v-else class="comparison-grid" data-testid="comparison-grid">
      <section v-for="comparison in comparisons" :key="comparison.targetId" class="comparison-card" :data-comparison-target="comparison.targetId">
        <header class="comparison-head">
          <div>
            <span>VS {{ planSet.plans[baseline].name }}</span>
            <h3>{{ planSet.plans[comparison.targetId].name }}相对差异</h3>
          </div>
          <button type="button" class="view-plan-button" @click="emit('select', comparison.targetId)">查看此方案</button>
        </header>

        <div class="diff-summary">
          <b class="added">{{ comparison.counts.added }} 件新增</b>
          <b class="removed">{{ comparison.counts.removed }} 件未再装入</b>
          <b class="moved">{{ comparison.counts.moved }} 件位置改变</b>
        </div>

        <div class="weight-margin" :class="{ reduced: comparison.weightMarginDelta < 0, increased: comparison.weightMarginDelta > 0 }">
          <span>箱体重量余量：{{ planSet.plans[baseline].name }} {{ marginText(comparison.baselineWeightMargin) }} → {{ planSet.plans[comparison.targetId].name }} {{ marginText(comparison.targetWeightMargin) }}</span>
          <strong>{{ deltaText(comparison.weightMarginDelta) }}</strong>
        </div>

        <p class="strategy-limit">本方案预留承重 {{ planSet.plans[comparison.targetId].weightLimit.toFixed(1) }}kg；重量余量按箱体 {{ suitcase.maxWeight.toFixed(1) }}kg 上限比较。</p>

        <p v-if="comparison.items.length === 0" class="diff-empty">两个方案装入物品和位置完全相同。</p>
        <ul v-else class="diff-list">
          <li v-for="diff in comparison.items" :key="diff.item.id">
            <button type="button" :class="['diff-row', diff.status]" :data-diff-item="diff.item.id" @click="focusDiff(diff, comparison.targetId)">
              <em>{{ statusLabel[diff.status] }}</em>
              <strong>{{ itemName(diff.item) }}</strong>
              <small>{{ positionText(diff) }}</small>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
