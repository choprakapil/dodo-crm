import { AnalyticsPreset } from "@/lib/validations/analytics";

export interface DateRangeBounds {
  start: Date;
  end: Date;
}

export interface ResolvedDateRange {
  current: DateRangeBounds;
  previous: DateRangeBounds;
  preset: AnalyticsPreset;
  timezone: string;
}

export interface ComparisonMetric {
  current: number;
  previous: number;
  changePercent: number; // e.g. +15.2 or -5.0
}

export interface LeadTrendPoint {
  date: string; // ISO date or "YYYY-MM-DD"
  label: string; // Display label e.g. "Sep 1"
  leads: number;
}

export interface StatusDistributionItem {
  id: string;
  name: string;
  color: string;
  count: number;
  percentage: number;
  value: number;
}

export interface SourceDistributionItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
  value: number;
}

export interface PipelineStageItem {
  statusId: string;
  stageName: string;
  color: string;
  leadCount: number;
  totalValue: number;
  percentageOfPipeline: number;
}

export interface PipelineAnalytics {
  totalValue: number;
  avgDealValue: number;
  stages: PipelineStageItem[];
  convertedValue: number;
  lostValue: number;
}

export interface LeadVelocityAnalytics {
  leadsPerDay: number;
  leadsPerWeek: number;
  avgDaysToConvert: number | null;
}

export interface TeamMemberPerformance {
  userId: string;
  name: string;
  email: string;
  roleName: string;
  assignedLeads: number;
  newLeads: number;
  convertedLeads: number;
  conversionRate: number;
  pipelineValue: number;
  completedFollowUps: number;
  overdueFollowUps: number;
  activitiesCount: number;
  calls: number;
  whatsApp: number;
  emails: number;
  meetings: number;
}

export interface ActivityAnalytics {
  total: number;
  byType: {
    CALL: number;
    WHATSAPP: number;
    EMAIL: number;
    MEETING: number;
    NOTE: number;
  };
}

export interface FollowUpAnalytics {
  created: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number; // e.g. 78.5%
}

export interface AnalyticsKpis {
  totalLeads: number;
  newLeads: ComparisonMetric;
  convertedLeads: ComparisonMetric;
  conversionRate: ComparisonMetric;
  pipelineValue: ComparisonMetric;
  followUpsDue: {
    dueInPeriod: number;
    pending: number;
    overdue: number;
  };
}

export interface AnalyticsOverviewData {
  kpis: AnalyticsKpis;
  trends: LeadTrendPoint[];
  statuses: StatusDistributionItem[];
  sources: SourceDistributionItem[];
  pipeline: PipelineAnalytics;
  velocity: LeadVelocityAnalytics;
  team: TeamMemberPerformance[];
  activities: ActivityAnalytics;
  followUps: FollowUpAnalytics;
}

export interface AnalyticsMeta {
  preset: AnalyticsPreset;
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  timezone: string;
  generatedAt: string;
}

export interface AnalyticsOverviewResponse {
  data: AnalyticsOverviewData;
  meta: AnalyticsMeta;
}
