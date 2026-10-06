import type { PackingItem, PackingPlan, PlanComparison, PlanDiffStatus, PlanItemDiff, PlanMode, Placement, Suitcase } from './models';

function placementByItem(plan: PackingPlan): Map<string, Placement> {
  return new Map(plan.placements.map((placement) => [placement.itemId, placement]));
}

function unplacedReasonByItem(plan: PackingPlan): Map<string, string> {
  return new Map(plan.unplaced.map(({ item, reason }) => [item.id, reason]));
}

function samePlacement(a?: Placement, b?: Placement): boolean {
  return Boolean(a && b
    && a.x === b.x
    && a.y === b.y
    && a.z === b.z
    && a.dimensions.length === b.dimensions.length
    && a.dimensions.width === b.dimensions.width
    && a.dimensions.height === b.dimensions.height);
}

export function comparePlans(
  baseline: PackingPlan,
  target: PackingPlan,
  items: PackingItem[],
  suitcase: Suitcase,
  generationId?: string,
): PlanComparison {
  const expectedGeneration = generationId ?? baseline.generationId;
  if (!expectedGeneration || baseline.generationId !== expectedGeneration || target.generationId !== expectedGeneration) {
    throw new Error('只能比较同一次计算生成的装箱方案');
  }

  const baselinePlacements = placementByItem(baseline);
  const targetPlacements = placementByItem(target);
  const baselineReasons = unplacedReasonByItem(baseline);
  const targetReasons = unplacedReasonByItem(target);
  const diffs: PlanItemDiff[] = [];

  for (const item of items) {
    const baselinePlacement = baselinePlacements.get(item.id);
    const targetPlacement = targetPlacements.get(item.id);
    const baselineReason = baselineReasons.get(item.id);
    const targetReason = targetReasons.get(item.id);

    let status: PlanDiffStatus | undefined;
    if (!baselinePlacement && targetPlacement) status = 'added';
    else if (baselinePlacement && !targetPlacement) status = 'removed';
    else if (baselinePlacement && targetPlacement && !samePlacement(baselinePlacement, targetPlacement)) status = 'moved';

    if (status) {
      diffs.push({ item, status, baselinePlacement, targetPlacement, baselineReason, targetReason });
    }
  }

  const baselineWeightMargin = suitcase.maxWeight - baseline.totalWeight;
  const targetWeightMargin = suitcase.maxWeight - target.totalWeight;
  const emptyCounts: Record<PlanDiffStatus, number> = { added: 0, removed: 0, moved: 0 };

  return {
    baselineId: baseline.id,
    targetId: target.id,
    generationId: expectedGeneration,
    items: diffs,
    baselineWeightMargin,
    targetWeightMargin,
    weightMarginDelta: targetWeightMargin - baselineWeightMargin,
    counts: diffs.reduce((counts, diff) => {
      counts[diff.status] += 1;
      return counts;
    }, emptyCounts),
  };
}

export function comparePlanSet(
  plans: Record<PlanMode, PackingPlan>,
  baselineId: PlanMode,
  targetId: PlanMode,
  items: PackingItem[],
  suitcase: Suitcase,
  generationId: string,
): PlanComparison {
  return comparePlans(plans[baselineId], plans[targetId], items, suitcase, generationId);
}
