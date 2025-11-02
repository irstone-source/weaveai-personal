/**
 * Comprehensive security monitoring and logging system
 * Tracks authentication events and security incidents
 */

export interface SecurityEvent {
  timestamp: string;
  eventType: SecurityEventType;
  level: SecurityLevel;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  details: Record<string, any>;
  context?: {
    url?: string;
    method?: string;
    referer?: string;
  };
}

export type SecurityEventType =
  // Authentication events
  | 'login_success'
  | 'login_failure'
  | 'login_rate_limited'
  | 'logout'
  | 'session_expired'
  | 'session_created'
  | 'session_refreshed'
  | 'session_invalidated'

  // Registration events
  | 'registration_success'
  | 'registration_failure'
  | 'registration_rate_limited'
  | 'email_verification_sent'
  | 'email_verification_success'
  | 'email_verification_failure'

  // Password events
  | 'password_reset_requested'
  | 'password_reset_success'
  | 'password_reset_failure'
  | 'password_change_success'
  | 'password_change_failure'

  // OAuth events
  | 'oauth_login_success'
  | 'oauth_login_failure'
  | 'oauth_provider_error'

  // Security incidents
  | 'suspicious_activity'
  | 'brute_force_attempt'
  | 'account_lockout'
  | 'security_header_violation'
  | 'csrf_token_mismatch'
  | 'invalid_session_token'
  | 'unauthorized_access_attempt'
  | 'data_breach_attempt'

  // System events
  | 'security_config_change'
  | 'admin_action'
  | 'data_export'
  | 'account_deletion';

export type SecurityLevel = 'info' | 'warn' | 'error' | 'critical';

/**
 * Security monitoring service
 */
class SecurityMonitoringService {
  private events: SecurityEvent[] = [];
  private readonly MAX_EVENTS = 10000; // Keep last 10k events in memory
  private alertThresholds: Map<SecurityEventType, { count: number; windowMs: number }> = new Map();

  constructor() {
    this.initializeAlertThresholds();
  }

  /**
   * Initialize alert thresholds for different event types
   */
  private initializeAlertThresholds(): void {
    // Login failure alerts
    this.alertThresholds.set('login_failure', { count: 5, windowMs: 15 * 60 * 1000 }); // 5 failures in 15 minutes
    this.alertThresholds.set('brute_force_attempt', { count: 10, windowMs: 60 * 60 * 1000 }); // 10 attempts in 1 hour

    // Registration alerts
    this.alertThresholds.set('registration_failure', { count: 3, windowMs: 60 * 60 * 1000 }); // 3 failures in 1 hour

    // Security incidents
    this.alertThresholds.set('suspicious_activity', { count: 1, windowMs: 60 * 60 * 1000 }); // Any suspicious activity
    this.alertThresholds.set('unauthorized_access_attempt', { count: 1, windowMs: 60 * 60 * 1000 }); // Any unauthorized access
  }

  /**
   * Log a security event
   */
  logEvent(
    eventType: SecurityEventType,
    level: SecurityLevel,
    details: Record<string, any>,
    context?: {
      userId?: string;
      email?: string;
      ip?: string;
      userAgent?: string;
      sessionId?: string;
      url?: string;
      method?: string;
      referer?: string;
    }
  ): void {
    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      eventType,
      level,
      userId: context?.userId,
      email: context?.email ? this.maskEmail(context.email) : undefined,
      ip: context?.ip ? this.maskIP(context.ip) : undefined,
      userAgent: context?.userAgent,
      sessionId: context?.sessionId,
      details: this.sanitizeDetails(details),
      context: {
        url: context?.url,
        method: context?.method,
        referer: context?.referer,
      }
    };

    // Add to memory store
    this.events.push(event);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift(); // Remove oldest event
    }

    // Log to console (in production, this would go to a logging service)
    this.outputLog(event);

    // Check for alerts
    this.checkAlerts(event);
  }

  /**
   * Sanitize sensitive details from logs
   */
  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };

    // Remove sensitive information
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }

    // Truncate long strings
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 500) + '...';
      }
    }

    return sanitized;
  }

  /**
   * Mask email addresses for privacy
   */
  private maskEmail(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex <= 0) return '[MASKED]';

    const localPart = email.substring(0, atIndex);
    const domain = email.substring(atIndex);

    if (localPart.length <= 2) {
      return '*'.repeat(localPart.length) + domain;
    }

    return localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1] + domain;
  }

  /**
   * Mask IP addresses for privacy
   */
  private maskIP(ip: string): string {
    if (ip.includes(':')) {
      // IPv6 - mask the last part
      const parts = ip.split(':');
      if (parts.length > 2) {
        parts[parts.length - 1] = 'xxxx';
        parts[parts.length - 2] = 'xxxx';
      }
      return parts.join(':');
    } else {
      // IPv4 - mask the last octet
      const parts = ip.split('.');
      if (parts.length === 4) {
        parts[3] = 'xxx';
      }
      return parts.join('.');
    }
  }

  /**
   * Output log to console or logging service
   */
  private outputLog(event: SecurityEvent): void {
    const logMethod = this.getLogMethod(event.level);
    const logEntry = {
      ...event,
      component: 'SecurityMonitoring'
    };

    logMethod(`[SECURITY] ${event.eventType.toUpperCase()}`, logEntry);
  }

  /**
   * Get appropriate log method based on level
   */
  private getLogMethod(level: SecurityLevel): (message: string, data?: any) => void {
    switch (level) {
      case 'critical':
      case 'error':
        return console.error;
      case 'warn':
        return console.warn;
      default:
        return console.log;
    }
  }

  /**
   * Check for security alerts based on event patterns
   */
  private checkAlerts(event: SecurityEvent): void {
    const threshold = this.alertThresholds.get(event.eventType);
    if (!threshold) return;

    const now = Date.now();
    const windowStart = now - threshold.windowMs;

    // Count recent events of the same type from the same source
    const recentEvents = this.events.filter(e =>
      e.eventType === event.eventType &&
      new Date(e.timestamp).getTime() > windowStart &&
      (e.ip === event.ip || e.email === event.email || e.userId === event.userId)
    );

    if (recentEvents.length >= threshold.count) {
      this.triggerAlert(event, recentEvents.length, threshold);
    }
  }

  /**
   * Trigger security alert
   */
  private triggerAlert(event: SecurityEvent, count: number, threshold: { count: number; windowMs: number }): void {
    const alertEvent: SecurityEvent = {
      timestamp: new Date().toISOString(),
      eventType: 'suspicious_activity',
      level: 'critical',
      ip: event.ip,
      email: event.email,
      userId: event.userId,
      details: {
        triggerEvent: event.eventType,
        eventCount: count,
        threshold: threshold.count,
        windowMinutes: threshold.windowMs / (1000 * 60),
        originalEvent: event
      }
    };

    console.error('[SECURITY ALERT]', alertEvent);

    // In production, this would trigger:
    // - Email alerts to administrators
    // - Slack/Discord notifications
    // - Automated response actions (IP blocking, account suspension)
    // - Integration with SIEM systems
  }

  /**
   * Get recent security events
   */
  getRecentEvents(
    limit: number = 100,
    eventType?: SecurityEventType,
    level?: SecurityLevel
  ): SecurityEvent[] {
    let filteredEvents = this.events;

    if (eventType) {
      filteredEvents = filteredEvents.filter(e => e.eventType === eventType);
    }

    if (level) {
      filteredEvents = filteredEvents.filter(e => e.level === level);
    }

    return filteredEvents
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get security statistics
   */
  getSecurityStats(hours: number = 24): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByLevel: Record<string, number>;
    uniqueIPs: number;
    uniqueUsers: number;
  } {
    const now = Date.now();
    const windowStart = now - (hours * 60 * 60 * 1000);

    const recentEvents = this.events.filter(e =>
      new Date(e.timestamp).getTime() > windowStart
    );

    const eventsByType: Record<string, number> = {};
    const eventsByLevel: Record<string, number> = {};
    const uniqueIPs = new Set<string>();
    const uniqueUsers = new Set<string>();

    for (const event of recentEvents) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsByLevel[event.level] = (eventsByLevel[event.level] || 0) + 1;

      if (event.ip) uniqueIPs.add(event.ip);
      if (event.userId) uniqueUsers.add(event.userId);
    }

    return {
      totalEvents: recentEvents.length,
      eventsByType,
      eventsByLevel,
      uniqueIPs: uniqueIPs.size,
      uniqueUsers: uniqueUsers.size
    };
  }

  /**
   * Clear old events (for memory management)
   */
  clearOldEvents(olderThanHours: number = 168): number { // Default: 1 week
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    const initialLength = this.events.length;

    this.events = this.events.filter(e =>
      new Date(e.timestamp).getTime() > cutoff
    );

    return initialLength - this.events.length;
  }
}

// Global security monitoring instance
export const securityMonitor = new SecurityMonitoringService();

/**
 * Convenience functions for common security events
 */
export const SecurityLogger = {
  // Authentication events
  loginSuccess: (userId: string, email: string, ip?: string, userAgent?: string) => {
    securityMonitor.logEvent('login_success', 'info', { userId, email }, { userId, email, ip, userAgent });
  },

  loginFailure: (email: string, reason: string, ip?: string, userAgent?: string) => {
    securityMonitor.logEvent('login_failure', 'warn', { email, reason }, { email, ip, userAgent });
  },

  loginRateLimited: (email: string, ip?: string) => {
    securityMonitor.logEvent('login_rate_limited', 'warn', { email, action: 'blocked' }, { email, ip });
  },

  logout: (userId: string, email: string, sessionId?: string) => {
    securityMonitor.logEvent('logout', 'info', { userId, email }, { userId, email, sessionId });
  },

  sessionCreated: (userId: string, email: string, sessionId: string, provider?: string) => {
    securityMonitor.logEvent('session_created', 'info', { userId, email, provider }, { userId, email, sessionId });
  },

  sessionExpired: (userId: string, sessionId: string) => {
    securityMonitor.logEvent('session_expired', 'info', { userId, sessionId }, { userId, sessionId });
  },

  // Registration events
  registrationSuccess: (userId: string, email: string, ip?: string) => {
    securityMonitor.logEvent('registration_success', 'info', { userId, email }, { userId, email, ip });
  },

  registrationFailure: (email: string, reason: string, ip?: string) => {
    securityMonitor.logEvent('registration_failure', 'warn', { email, reason }, { email, ip });
  },

  // Password events
  passwordResetRequested: (email: string, ip?: string) => {
    securityMonitor.logEvent('password_reset_requested', 'info', { email }, { email, ip });
  },

  passwordResetSuccess: (userId: string, email: string, ip?: string) => {
    securityMonitor.logEvent('password_reset_success', 'info', { userId, email }, { userId, email, ip });
  },

  passwordResetFailure: (email: string, reason: string, ip?: string) => {
    securityMonitor.logEvent('password_reset_failure', 'warn', { email, reason }, { email, ip });
  },

  // Email verification events
  emailVerificationSent: (email: string, userId?: string) => {
    securityMonitor.logEvent('email_verification_sent', 'info', { email }, { email, userId });
  },

  emailVerificationSuccess: (userId: string, email: string) => {
    securityMonitor.logEvent('email_verification_success', 'info', { userId, email }, { userId, email });
  },

  emailVerificationFailure: (email: string, reason: string) => {
    securityMonitor.logEvent('email_verification_failure', 'warn', { email, reason }, { email });
  },

  // OAuth events
  oauthLoginSuccess: (userId: string, email: string, provider: string, ip?: string) => {
    securityMonitor.logEvent('oauth_login_success', 'info', { userId, email, provider }, { userId, email, ip });
  },

  oauthLoginFailure: (email: string, provider: string, reason: string, ip?: string) => {
    securityMonitor.logEvent('oauth_login_failure', 'warn', { email, provider, reason }, { email, ip });
  },

  // Security incidents
  suspiciousActivity: (reason: string, details: Record<string, any>, ip?: string, userId?: string) => {
    securityMonitor.logEvent('suspicious_activity', 'critical', { reason, ...details }, { ip, userId });
  },

  bruteForceAttempt: (email: string, attemptCount: number, ip?: string) => {
    securityMonitor.logEvent('brute_force_attempt', 'critical', { email, attemptCount }, { email, ip });
  },

  unauthorizedAccess: (resource: string, ip?: string, userId?: string, userAgent?: string) => {
    securityMonitor.logEvent('unauthorized_access_attempt', 'critical', { resource }, { ip, userId, userAgent });
  },

  csrfTokenMismatch: (ip?: string, userAgent?: string, url?: string) => {
    securityMonitor.logEvent('csrf_token_mismatch', 'error', { url }, { ip, userAgent, url });
  },

  invalidSessionToken: (token: string, ip?: string, userAgent?: string) => {
    securityMonitor.logEvent('invalid_session_token', 'error', { tokenPrefix: token.substring(0, 8) }, { ip, userAgent });
  },

  // Admin events
  adminAction: (adminId: string, action: string, targetUserId?: string, details?: Record<string, any>) => {
    securityMonitor.logEvent('admin_action', 'info', { adminId, action, targetUserId, ...details }, { userId: adminId });
  },

  accountDeletion: (userId: string, email: string, initiatedBy: 'user' | 'admin', adminId?: string) => {
    securityMonitor.logEvent('account_deletion', 'info', { userId, email, initiatedBy, adminId }, { userId, email });
  }
};

// Clean up old events every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const removed = securityMonitor.clearOldEvents();
    if (removed > 0) {
      console.log(`[SecurityMonitoring] Cleaned up ${removed} old security events`);
    }
  }, 60 * 60 * 1000); // 1 hour
}