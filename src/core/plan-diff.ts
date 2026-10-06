import type { PackingItem, PackingPlan, Placement, PlanMode, Suitcase } from './models';

/** 物品在另一方案中新增装入 */
export interface PlanDiffAddedEntry {
  kind: 'added';
  itemId: string;
  item: PackingItem;
  otherPlacement: Placement;
  /** 基准方案中该物品未装入的原因（若基准中同样未装入则为空） */
  baselineReason?: string;
}

/** 物品在另一方案中不再装入 */
export interface PlanDiffRemovedEntry {
  kind: 'removed';
  itemId: string;
  item: PackingItem;
  baselinePlacement: Placement;
  /** 另一方案给出的未装入原因 */
  reason: string;
}

/** 两个方案都装入，但位置或摆放方向不同 */
export interface PlanDiffMovedEntry {
  kind: 'moved';
  itemId: string;
  item: PackingItem;
  baselinePlacement: Placement;
  otherPlacement: Placement;
}

export type PlanDiffEntry = PlanDiffAddedEntry | PlanDiffRemovedEntry | PlanDiffMovedEntry;

export interface PlanWeightMargin {
  /** 箱体承重余量：maxWeight - 已装重量 */
  baseline: number;
  other: number;
  /** 相对基准，余量是增加还是减少 */
  delta: number;
}

export interface PlanDiff {
  baselineId: PlanMode;
  otherId: PlanMode;
  added: PlanDiffAddedEntry[];
  removed: PlanDiffRemovedEntry[];
  moved: PlanDiffMovedEntry[];
  unchanged: Array<{ itemId: string; item: PackingItem }>;
  weightMargin: PlanWeightMargin;
}

function samePlacement(a: Placement, b: Placement): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z
    && a.dimensions.length === b.dimensions.length
    && a.dimensions.width === b.dimensions.width
    && a.dimensions.height === b.dimensions.height;
}

function reasonOf(plan: PackingPlan, itemId: string): string | undefined {
  return plan.unplaced.find((entry) => entry.item.id === itemId)?.reason;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * 以物品 id 为身份，比较 other 相对 baseline 的装箱差异。
 * 只读两个方案的同一次计算结果，不修改物品、优先级或任何输入。
 */
export function comparePlans(
  baseline: PackingPlan,
  other: PackingPlan,
  items: PackingItem[],
  suitcase: Suitcase,
): PlanDiff {
  const byId = new Map(items.map((item) => [item.id, item]));
  const baselineMap = new Map(baseline.placements.map((placement) => [placement.itemId, placement]));
  const otherMap = new Map(other.placements.map((placement) => [placement.itemId, placement]));
  const added: PlanDiffAddedEntry[] = [];
  const removed: PlanDiffRemovedEntry[] = [];
  const moved: PlanDiffMovedEntry[] = [];
  const unchanged: PlanDiff['unchanged'] = [];

  for (const placement of other.placements) {
    const item = byId.get(placement.itemId);
    if (!item) continue;
    const baselinePlacement = baselineMap.get(placement.itemId);
    if (!baselinePlacement) {
      added.push({
        kind: 'added', itemId: item.id, item, otherPlacement: placement,
        baselineReason: reasonOf(baseline, item.id),
      });
    } else if (!samePlacement(baselinePlacement, placement)) {
      moved.push({ kind: 'moved', itemId: item.id, item, baselinePlacement, otherPlacement: placement });
    } else {
      unchanged.push({ itemId: item.id, item });
    }
  }

  for (const placement of baseline.placements) {
    const item = byId.get(placement.itemId);
    if (!item || otherMap.has(placement.itemId)) continue;
    removed.push({
      kind: 'removed', itemId: item.id, item, baselinePlacement: placement,
      reason: reasonOf(other, item.id) ?? '未装入',
    });
  }

  // 顺序与方案的摆放顺序一致，保证结果可重复、可解释
  added.sort((a, b) => other.placements.findIndex((p) => p.itemId === a.itemId) - other.placements.findIndex((p) => p.itemId === b.itemId));
  removed.sort((a, b) => baseline.placements.findIndex((p) => p.itemId === a.itemId) - baseline.placements.findIndex((p) => p.itemId === b.itemId));
  moved.sort((a, b) => baseline.placements.findIndex((p) => p.itemId === a.itemId) - baseline.placements.findIndex((p) => p.itemId === b.itemId));

  const baselineMargin = suitcase.maxWeight - baseline.totalWeight;
  const otherMargin = suitcase.maxWeight - other.totalWeight;
  return {
    baselineId: baseline.id,
    otherId: other.id,
    added,
    removed,
    moved,
    unchanged,
    weightMargin: { baseline: round3(baselineMargin), other: round3(otherMargin), delta: round3(otherMargin - baselineMargin) },
  };
}
