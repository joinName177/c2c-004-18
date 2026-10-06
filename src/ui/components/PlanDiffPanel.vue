<script setup lang="ts">
import { computed, ref } from 'vue';
import { comparePlans, type PlanDiff, type PlanDiffEntry } from '../../core/plan-diff';
import type { PackingItem, PackingPlan, PlanMode, Suitcase } from '../../core/models';

const props = defineProps<{
  plans: Record<PlanMode, PackingPlan>;
  items: PackingItem[];
  suitcase: Suitcase;
  stale: boolean;
}>();
const emit = defineEmits<{ locate: [payload: { mode: PlanMode; itemId: string; kind: PlanDiffEntry['kind'] }] }>();

const baselineId = ref<PlanMode>('comfort');
const otherModes = computed<PlanMode[]>(() => (['minimal', 'comfort', 'shopping'] as PlanMode[]).filter((mode) => mode !== baselineId.value));
const diffs = computed<Partial<Record<PlanMode, PlanDiff>>>(() => {
  const baseline = props.plans[baselineId.value];
  const result: Partial<Record<PlanMode, PlanDiff>> = {};
  for (const mode of otherModes.value) result[mode] = comparePlans(baseline, props.plans[mode], props.items, props.suitcase);
  return result;
});

const labelOf: Record<PlanMode, string> = { minimal: '精简版', comfort: '舒适版', shopping: '购物版' };
const kindLabel: Record<PlanDiffEntry['kind'], string> = { added: '新增装入', removed: '未再装入', moved: '位置改变' };
function coord(p: { x: number; y: number; z: number }) { return `${p.x}, ${p.y}, ${p.z}`; }
function signed(value: number) { return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1); }
function locate(mode: PlanMode, entry: PlanDiffEntry) { emit('locate', { mode, itemId: entry.itemId, kind: entry.kind }); }
function diffCount(diff: PlanDiff) { return diff.added.length + diff.removed.length + diff.moved.length; }
</script>

<template>
  <section class="diff-panel" data-testid="plan-diff">
    <div v-if="stale" class="diff-stale" data-testid="diff-stale">
      <strong>方案对比已失效</strong>
      <span>清单或箱体已调整，请点击「智能装箱」重新计算三套方案后再查看差异。</span>
    </div>
    <template v-else>
      <div class="diff-head">
        <div><span>PLAN DIFF</span><h2>方案差异对比</h2><p>按物品身份对照另一方案相对基准的变化，点击任意差异项切换方案并定位。</p></div>
        <div class="baseline-picker">
          <small>基准方案</small>
          <div class="baseline-tabs">
            <button v-for="mode in (['minimal','comfort','shopping'] as PlanMode[])" :key="mode" type="button" :class="{ active: mode === baselineId }" @click="baselineId = mode">{{ labelOf[mode] }}</button>
          </div>
        </div>
      </div>
      <div class="diff-grid">
        <article v-for="mode in otherModes" :key="mode" class="diff-card" :data-diff-mode="mode">
          <header>
            <div><span>VS BASELINE</span><h3>{{ labelOf[mode] }} <em>vs</em> {{ labelOf[baselineId] }}</h3></div>
            <b class="diff-total" :data-testid="`diff-count-${mode}`">{{ diffCount(diffs[mode]!) }}</b>
          </header>
          <div class="margin-line" :data-testid="`margin-${mode}`">
            <span>承重余量</span>
            <strong>{{ diffs[mode]!.weightMargin.baseline.toFixed(1) }}kg → {{ diffs[mode]!.weightMargin.other.toFixed(1) }}kg</strong>
            <b :class="diffs[mode]!.weightMargin.delta >= 0 ? 'up' : 'down'">{{ signed(diffs[mode]!.weightMargin.delta) }}kg</b>
          </div>
          <p v-if="diffCount(diffs[mode]!) === 0" class="diff-empty">与基准一致，装入物品、位置与重量均无差异。</p>
          <div v-for="entry in diffs[mode]!.added" :key="`added-${entry.itemId}`" class="diff-row added" role="button" tabindex="0" :data-diff-kind="entry.kind" :data-item-id="entry.itemId" @click="locate(mode, entry)" @keydown.enter="locate(mode, entry)">
            <i>＋</i><div class="diff-copy"><strong>{{ entry.item.name }}</strong><span>{{ kindLabel.added }}<template v-if="entry.baselineReason"> · 基准未装：{{ entry.baselineReason }}</template></span></div><em>定位 →</em>
          </div>
          <div v-for="entry in diffs[mode]!.removed" :key="`removed-${entry.itemId}`" class="diff-row removed" role="button" tabindex="0" :data-diff-kind="entry.kind" :data-item-id="entry.itemId" @click="locate(mode, entry)" @keydown.enter="locate(mode, entry)">
            <i>－</i><div class="diff-copy"><strong>{{ entry.item.name }}</strong><span>{{ kindLabel.removed }} · {{ entry.reason }}</span></div><em>原因 →</em>
          </div>
          <div v-for="entry in diffs[mode]!.moved" :key="`moved-${entry.itemId}`" class="diff-row moved" role="button" tabindex="0" :data-diff-kind="entry.kind" :data-item-id="entry.itemId" @click="locate(mode, entry)" @keydown.enter="locate(mode, entry)">
            <i>↔</i><div class="diff-copy"><strong>{{ entry.item.name }}</strong><span>{{ kindLabel.moved }} · ({{ coord(entry.baselinePlacement) }}) → ({{ coord(entry.otherPlacement) }})</span></div><em>定位 →</em>
          </div>
          <footer class="diff-foot">{{ diffs[mode]!.unchanged.length }} 件物品位置不变</footer>
        </article>
      </div>
    </template>
  </section>
</template>
