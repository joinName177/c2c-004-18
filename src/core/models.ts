export type Dimensions = Readonly<{ length: number; width: number; height: number }>;
export type PlanMode = 'minimal' | 'comfort' | 'shopping';
export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface Suitcase extends Dimensions {
  maxWeight: number;
}

export interface PackingItem extends Dimensions {
  id: string;
  name: string;
  category: string;
  weight: number;
  priority: 1 | 2 | 3;
  mustHave: boolean;
  fragile?: boolean;
}

export interface Placement {
  itemId: string;
  x: number;
  y: number;
  z: number;
  dimensions: Dimensions;
}

export interface PackingPlan {
  id: PlanMode;
  name: string;
  generationId?: string;
  placements: Placement[];
  unplaced: Array<{ item: PackingItem; reason: string }>;
  totalWeight: number;
  weightLimit: number;
  usedVolume: number;
  capacityRatio: number;
}

export interface GeneratedPlanSet {
  generationId: string;
  plans: Record<PlanMode, PackingPlan>;
}

export type PlanDiffStatus = 'added' | 'removed' | 'moved';

export interface PlanItemDiff {
  item: PackingItem;
  status: PlanDiffStatus;
  baselinePlacement?: Placement;
  targetPlacement?: Placement;
  baselineReason?: string;
  targetReason?: string;
}

export interface PlanComparison {
  baselineId: PlanMode;
  targetId: PlanMode;
  generationId: string;
  items: PlanItemDiff[];
  baselineWeightMargin: number;
  targetWeightMargin: number;
  weightMarginDelta: number;
  counts: Record<PlanDiffStatus, number>;
}

export interface Risk {
  id: string;
  severity: RiskSeverity;
  title: string;
  message: string;
  itemId?: string;
}

export interface PackingSnapshot {
  suitcase: Suitcase;
  items: PackingItem[];
  selectedPlan: PlanMode;
}

export function itemVolume(item: Dimensions): number {
  return item.length * item.width * item.height;
}

export function suitcaseVolume(suitcase: Dimensions): number {
  return suitcase.length * suitcase.width * suitcase.height;
}
