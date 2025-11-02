// Analytics configuration constants
// Centralized configuration for analytics behavior and limits

export const ANALYTICS_CONFIG = {
  // Time periods
  DEFAULT_PERIOD_DAYS: 90,
  MAX_PERIOD_DAYS: 365,      // Maximum 1 year of historical data
  MIN_PERIOD_DAYS: 1,        // Minimum 1 day

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 60 * 1000,  // 1 minute window
  RATE_LIMIT_MAX_REQUESTS: 10,      // 10 requests per window per user
  
  // Cache settings (for future implementation)
  CACHE_TTL_SECONDS: 300,           // 5 minutes for current period data
  HISTORICAL_CACHE_TTL_SECONDS: 3600, // 1 hour for historical data

  // Database query limits
  MAX_DATA_POINTS: 400,             // Maximum data points to return
  QUERY_TIMEOUT_MS: 10000,          // 10 second database query timeout

  // Chart display settings
  CHART_HEIGHT: 250,                // Chart height in pixels
  CHART_ANIMATION_DURATION: 300,    // Animation duration in ms
  
  // Data validation
  MAX_CHAT_COUNT_PER_DAY: 10000,    // Sanity check for daily chat counts
  MIN_PERCENTAGE_CHANGE: -99.9,     // Minimum allowed percentage change
  MAX_PERCENTAGE_CHANGE: 999.9,     // Maximum allowed percentage change
} as const;

// Configuration validation
export function validateAnalyticsConfig() {
  const config = ANALYTICS_CONFIG;
  
  if (config.DEFAULT_PERIOD_DAYS > config.MAX_PERIOD_DAYS) {
    throw new Error('Default period cannot exceed maximum period');
  }
  
  if (config.MIN_PERIOD_DAYS < 1) {
    throw new Error('Minimum period must be at least 1 day');
  }
  
  if (config.RATE_LIMIT_MAX_REQUESTS <= 0) {
    throw new Error('Rate limit must be greater than 0');
  }
  
  return true;
}

// Environment-specific overrides (for different deployment environments)
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'development':
      return {
        ...ANALYTICS_CONFIG,
        RATE_LIMIT_MAX_REQUESTS: 100, // More lenient in development
        QUERY_TIMEOUT_MS: 30000,      // Longer timeout for development
      };
    
    case 'test':
      return {
        ...ANALYTICS_CONFIG,
        DEFAULT_PERIOD_DAYS: 7,       // Shorter period for tests
        RATE_LIMIT_MAX_REQUESTS: 1000, // No rate limiting in tests
      };
    
    case 'production':
    default:
      return ANALYTICS_CONFIG;
  }
}

// Helper functions for configuration access
export function getAnalyticsPeriodDays(): number {
  return getEnvironmentConfig().DEFAULT_PERIOD_DAYS;
}

export function getMaxAnalyticsPeriodDays(): number {
  return getEnvironmentConfig().MAX_PERIOD_DAYS;
}

export function getRateLimitConfig() {
  const config = getEnvironmentConfig();
  return {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  };
}