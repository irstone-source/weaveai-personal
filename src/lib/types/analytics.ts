// Analytics type definitions for type safety across the application

export interface AnalyticsDataPoint {
  date: Date;
  chats: number;
  totalUsers: number;
  activeSubscriptions: number;
  revenue: number;
}

export interface AnalyticsApiResponse {
  success: boolean;
  data: AnalyticsDataPoint[];
  totalChats: number;
  totalUsers: number;
  totalActiveSubscriptions: number;
  totalRevenue: number;
  percentageChange: number;
  revenuePercentageChange: number;
}

export interface AnalyticsMetrics {
  totalChats: number;
  dailyAverage: number;
  peakDay: number;
  activeDays: number;
  percentageChange: number;
  isPositiveTrend: boolean;
}

export interface RateLimitInfo {
  count: number;
  resetTime: number;
}

// Configuration interface for analytics parameters
export interface AnalyticsConfig {
  defaultPeriodDays: number;
  maxPeriodDays: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

// Database query result types
export interface DailyChatCount {
  date: string;
  count: number;
}

export interface DailyUserCount {
  date: string;
  count: number;
}

export interface DailySubscriptionCount {
  date: string;
  count: number;
}

export interface DailyRevenueCount {
  date: string;
  revenue: number;
}

export interface PeriodChatCount {
  count: number;
}

// Area Chart specific types
export interface UserGrowthDataPoint {
  date: Date;
  totalUsers: number;
  activeSubscriptions: number;
}