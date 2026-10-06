import { packItems } from './packing-engine';
import type { GeneratedPlanSet, PackingItem, PackingPlan, PlanMode, Suitcase } from './models';

const PLAN_MODES: PlanMode[] = ['minimal', 'comfort', 'shopping'];
let generation = 0;

export function createPlanGenerationId(): string {
  generation += 1;
  return `plan-${Date.now().toString(36)}-${generation}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generatePlanSet(suitcase: Suitcase, items: PackingItem[]): GeneratedPlanSet {
  const generationId = createPlanGenerationId();
  const plans = Object.fromEntries(PLAN_MODES.map((mode) => [
    mode,
    { ...packItems(suitcase, items, mode), generationId },
  ])) as Record<PlanMode, PackingPlan>;
  return { generationId, plans };
}

export function generatePlans(suitcase: Suitcase, items: PackingItem[]): Record<PlanMode, PackingPlan> {
  return generatePlanSet(suitcase, items).plans;
}
