/**
 * 前端性能优化工具
 * 提供性能监控、优化和分析功能
 */

export interface PerformanceEntry {
  name: string;
  duration: number;
  startTime: number;
  entryType: string;
}

export interface PerformanceReport {
  pageLoadTime: number;
  domContentLoadedTime: number;
  firstPaintTime: number;
  firstContentfulPaintTime: number;
  largestContentfulPaintTime: number;
  timeToInteractive: number;
  totalBlockingTime: number;
}

/**
 * 性能监控类
 */
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: PerformanceEntry[] = [];

  /**
   * 标记性能时间点
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
    if (typeof performance.mark === 'function') {
      performance.mark(name);
    }
  }

  /**
   * 测量两个标记之间的时间
   */
  measure(name: string, startMark: string, endMark?: string): number {
    const startTime = this.marks.get(startMark);
    if (!startTime) {
      console.warn(`Start mark "${startMark}" not found`);
      return 0;
    }

    const endTime = endMark ? this.marks.get(endMark) : performance.now();
    if (endMark && !endTime) {
      console.warn(`End mark "${endMark}" not found`);
      return 0;
    }

    const duration = (endTime || performance.now()) - startTime;

    this.measures.push({
      name,
      duration,
      startTime,
      entryType: 'measure',
    });

    if (typeof performance.measure === 'function') {
      try {
        performance.measure(name, startMark, endMark);
      } catch (error) {
        console.warn('Performance.measure failed:', error);
      }
    }

    return duration;
  }

  /**
   * 获取所有测量结果
   */
  getMeasures(): PerformanceEntry[] {
    return [...this.measures];
  }

  /**
   * 清除所有标记和测量
   */
  clear(): void {
    this.marks.clear();
    this.measures = [];
    if (typeof performance.clearMarks === 'function') {
      performance.clearMarks();
    }
    if (typeof performance.clearMeasures === 'function') {
      performance.clearMeasures();
    }
  }

  /**
   * 获取页面性能报告
   */
  getPerformanceReport(): Partial<PerformanceReport> {
    const report: Partial<PerformanceReport> = {};

    if (typeof performance.getEntriesByType === 'function') {
      // 获取导航时间
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      if (navigation) {
        report.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
        report.domContentLoadedTime =
          navigation.domContentLoadedEventEnd - navigation.fetchStart;
      }

      // 获取绘制时间
      const paintEntries = performance.getEntriesByType('paint');
      for (const entry of paintEntries) {
        if (entry.name === 'first-paint') {
          report.firstPaintTime = entry.startTime;
        } else if (entry.name === 'first-contentful-paint') {
          report.firstContentfulPaintTime = entry.startTime;
        }
      }

      // 获取LCP (Largest Contentful Paint)
      const lcpEntries = performance.getEntriesByType(
        'largest-contentful-paint',
      );
      if (lcpEntries.length > 0) {
        const lcp = lcpEntries[lcpEntries.length - 1];
        report.largestContentfulPaintTime = lcp.startTime;
      }
    }

    return report;
  }

  /**
   * 监控长任务
   */
  observeLongTasks(callback: (entries: PerformanceEntry[]) => void): void {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEntry[];
        callback(entries);
      });

      observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      console.warn('Long task observation not supported:', error);
    }
  }

  /**
   * 监控资源加载
   */
  observeResources(callback: (entries: PerformanceEntry[]) => void): void {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEntry[];
        callback(entries);
      });

      observer.observe({ entryTypes: ['resource'] });
    } catch (error) {
      console.warn('Resource observation not supported:', error);
    }
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * 懒加载图片
 */
export function lazyLoadImages(): void {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        }
      }
    });

    const images = document.querySelectorAll('img[data-src]');
    for (const img of images) {
      imageObserver.observe(img);
    }
  }
}

/**
 * 预加载关键资源
 */
export function preloadCriticalResources(urls: string[]): void {
  for (const url of urls) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = getResourceType(url);
    link.href = url;
    document.head.appendChild(link);
  }
}

/**
 * 获取资源类型
 */
function getResourceType(url: string): string {
  if (url.endsWith('.js')) return 'script';
  if (url.endsWith('.css')) return 'style';
  if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';
  if (url.match(/\.(woff|woff2|ttf|otf)$/)) return 'font';
  return 'fetch';
}

/**
 * 内存监控
 */
export function getMemoryUsage(): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
} | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }
  return null;
}

/**
 * 网络信息监控
 */
export function getNetworkInfo(): {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
} | null {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  }
  return null;
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

// 自动初始化性能监控
if (typeof window !== 'undefined') {
  // 页面加载完成后记录性能指标
  window.addEventListener('load', () => {
    setTimeout(() => {
      const report = performanceMonitor.getPerformanceReport();
      console.log('Performance Report:', report);
    }, 0);
  });
}
