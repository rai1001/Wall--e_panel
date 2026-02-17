export interface RouteMetric {
  key: string;
  count: number;
  errors: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

interface RouteMetricInternal {
  count: number;
  errors: number;
  totalLatencyMs: number;
  samples: number[];
}

export interface MetricsSnapshot {
  startedAt: string;
  requests: {
    total: number;
    errors: number;
    routes: RouteMetric[];
  };
  automation: {
    runs: number;
    failedRuns: number;
    retries: number;
  };
}

export class MetricsService {
  private readonly startedAt = new Date().toISOString();
  private totalRequests = 0;
  private totalErrors = 0;
  private automationRuns = 0;
  private automationFailedRuns = 0;
  private automationRetries = 0;
  private readonly routeMetrics = new Map<string, RouteMetricInternal>();

  recordRequest(key: string, latencyMs: number, statusCode: number) {
    this.totalRequests += 1;
    if (statusCode >= 400) {
      this.totalErrors += 1;
    }

    const current = this.routeMetrics.get(key) ?? {
      count: 0,
      errors: 0,
      totalLatencyMs: 0,
      samples: []
    };

    current.count += 1;
    if (statusCode >= 400) {
      current.errors += 1;
    }
    current.totalLatencyMs += latencyMs;
    current.samples.push(latencyMs);
    if (current.samples.length > 200) {
      current.samples.shift();
    }

    this.routeMetrics.set(key, current);
  }

  recordAutomationRun(status: "success" | "failed", attempts: number) {
    this.automationRuns += 1;
    if (status === "failed") {
      this.automationFailedRuns += 1;
    }
    if (attempts > 1) {
      this.automationRetries += attempts - 1;
    }
  }

  snapshot(): MetricsSnapshot {
    const routes: RouteMetric[] = [];
    for (const [key, metric] of this.routeMetrics.entries()) {
      const sorted = [...metric.samples].sort((a, b) => a - b);
      const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
      routes.push({
        key,
        count: metric.count,
        errors: metric.errors,
        avgLatencyMs: Number((metric.totalLatencyMs / metric.count).toFixed(2)),
        p95LatencyMs: Number((sorted[p95Index] ?? 0).toFixed(2))
      });
    }

    routes.sort((a, b) => b.count - a.count);

    return {
      startedAt: this.startedAt,
      requests: {
        total: this.totalRequests,
        errors: this.totalErrors,
        routes
      },
      automation: {
        runs: this.automationRuns,
        failedRuns: this.automationFailedRuns,
        retries: this.automationRetries
      }
    };
  }
}
