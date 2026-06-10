export interface DeepLearningPrediction {
  riskScore: number;
  bottleneckScore: number;
  priorityScore: number;
  priorityLabel: string;
  recommendedAction: string;
  modelUsed: boolean;
  bottleneckDelayHours: number;
  bottleneckRatio: number;
  slaExceeded: boolean;
}

export interface DeepLearningPredictedItem {
  processInstanceId: string;
  assignmentId: string;
  diagramId: string;
  diagramName: string;
  stepIndex: number;
  nodeId: string;
  assignedDepartmentId: string;
  assignedDepartmentName: string;
  assignedCargoId: string;
  assignedUserId: string;
  workerActiveLoad: number;
  departmentActiveLoad: number;
  assignmentDurationHours: number | null;
  currentStepDurationHours: number | null;
  accumulatedDurationHours: number | null;
  reworkCount: number;
  slaHoursTarget: number;
  nodeActivationCount: number;
  originalPriorityLabel: string;
  originalRecommendedAction: string;
  originalBottleneck: boolean;
  originalAnomalous: boolean;
  prediction: DeepLearningPrediction;
}

export interface DeepLearningPredictionSummary {
  normalCount: number;
  mediumCount: number;
  highCount: number;
  bottleneckCount: number;
  slaExceededCount: number;
  averageRiskScore: number;
  averageBottleneckScore: number;
}

export interface DeepLearningCurrentPredictionsResponse {
  totalItems: number;
  generatedAt: string;
  modelUsed: boolean;
  summary: DeepLearningPredictionSummary;
  items: DeepLearningPredictedItem[];
}
