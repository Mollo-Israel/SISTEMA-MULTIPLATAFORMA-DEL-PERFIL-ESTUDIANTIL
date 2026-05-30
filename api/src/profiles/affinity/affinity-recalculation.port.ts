export const AFFINITY_RECALCULATION = 'AFFINITY_RECALCULATION';

export interface AffinityRecalculationPort {
  requestRecalculation(studentProfileId: string): Promise<void>;
}
