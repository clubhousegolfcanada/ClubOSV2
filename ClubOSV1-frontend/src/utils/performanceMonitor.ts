// Performance monitoring for animations and transitions

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  droppedFrames: number;
}

class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 0;
  private frameTime = 0;
  private droppedFrames = 0;
  private rafId: number | null = null;
  private callbacks: ((metrics: PerformanceMetrics) => void)[] = [];

  start() {
    if (this.rafId !== null) return;
    
    const measure = (currentTime: number) => {
      this.frameCount++;
      const deltaTime = currentTime - this.lastTime;
      
      // Calculate FPS every second
      if (deltaTime >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / deltaTime);
        this.frameTime = deltaTime / this.frameCount;
        
        // Detect dropped frames (anything over 16.67ms for 60fps)
        if (this.frameTime > 16.67) {
          this.droppedFrames++;
        }
        
        // Notify callbacks
        const metrics: PerformanceMetrics = {
          fps: this.fps,
          frameTime: this.frameTime,
          droppedFrames: this.droppedFrames
        };
        
        this.callbacks.forEach(cb => cb(metrics));
        
        // Reset counters
        this.frameCount = 0;
        this.lastTime = currentTime;
      }
      
      this.rafId = requestAnimationFrame(measure);
    };
    
    this.rafId = requestAnimationFrame(measure);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  getMetrics(): PerformanceMetrics {
    return {
      fps: this.fps,
      frameTime: this.frameTime,
      droppedFrames: this.droppedFrames
    };
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Helper to measure animation performance
export const measureAnimation = (animationFn: () => void): Promise<PerformanceMetrics> => {
  return new Promise((resolve) => {
    const startMetrics = performanceMonitor.getMetrics();
    
    requestAnimationFrame(() => {
      animationFn();
      
      // Measure after animation completes
      requestAnimationFrame(() => {
        const endMetrics = performanceMonitor.getMetrics();
        resolve({
          fps: endMetrics.fps,
          frameTime: endMetrics.frameTime,
          droppedFrames: endMetrics.droppedFrames - startMetrics.droppedFrames
        });
      });
    });
  });
};

// Utility to detect high refresh rate displays
export const getDisplayRefreshRate = async (): Promise<number> => {
  if (!window.requestAnimationFrame) return 60;
  
  const samples: number[] = [];
  let lastTime = performance.now();
  
  return new Promise((resolve) => {
    const sample = () => {
      const currentTime = performance.now();
      const delta = currentTime - lastTime;
      
      if (delta > 0) {
        samples.push(1000 / delta);
      }
      
      lastTime = currentTime;
      
      if (samples.length < 60) {
        requestAnimationFrame(sample);
      } else {
        // Calculate average refresh rate
        const avgRefreshRate = samples.reduce((a, b) => a + b, 0) / samples.length;
        resolve(Math.round(avgRefreshRate));
      }
    };
    
    requestAnimationFrame(sample);
  });
};

// CSS variable updater for adaptive animations
export const updateAnimationDurations = async () => {
  const refreshRate = await getDisplayRefreshRate();
  const root = document.documentElement;
  
  if (refreshRate >= 120) {
    // Ultra-smooth animations for 120Hz+ displays
    root.style.setProperty('--animation-duration-fast', '100ms');
    root.style.setProperty('--animation-duration-normal', '167ms');
    root.style.setProperty('--animation-duration-slow', '250ms');
  } else if (refreshRate >= 90) {
    // Smooth animations for 90Hz displays
    root.style.setProperty('--animation-duration-fast', '111ms');
    root.style.setProperty('--animation-duration-normal', '185ms');
    root.style.setProperty('--animation-duration-slow', '278ms');
  } else {
    // Standard animations for 60Hz displays
    root.style.setProperty('--animation-duration-fast', '150ms');
    root.style.setProperty('--animation-duration-normal', '250ms');
    root.style.setProperty('--animation-duration-slow', '350ms');
  }
  
  console.log(`Display refresh rate detected: ${refreshRate}Hz`);
};