// Optimized animation classes for high refresh rate displays

export const animationClasses = {
  // Base GPU acceleration
  gpuAccelerated: 'gpu-accelerated',
  
  // Smooth transitions
  smoothTransition: 'smooth-transition',
  
  // Buttons and clickable elements
  button: 'gpu-accelerated smooth-transition',
  buttonHover: 'hover:transform hover:-translate-y-px',
  buttonActive: 'active:scale-[0.98]',
  
  // Cards
  card: 'gpu-accelerated smooth-transition',
  cardHover: 'hover:transform hover:-translate-y-0.5',
  
  // List items
  listItem: 'gpu-accelerated smooth-transition',
  listItemHover: 'hover:bg-[var(--bg-tertiary)]',
  
  // Messages
  messageBubble: 'message-bubble gpu-accelerated',
  
  // Page transitions
  pageTransition: 'page-transition',
  
  // Modals
  modalBackdrop: 'modal-backdrop gpu-accelerated',
  modalContent: 'modal-content gpu-accelerated',
  
  // Loading
  loadingSpinner: 'loading-spinner',
  skeleton: 'skeleton',
  
  // Scroll containers
  scrollContainer: 'scroll-container',
  
  // Combined classes
  interactiveElement: 'gpu-accelerated smooth-transition hover:transform hover:-translate-y-px active:scale-[0.98]',
  
  // Helper function to combine classes
  combine: (...classes: string[]) => classes.filter(Boolean).join(' ')
};

// Helper to replace transition-colors with optimized version
export const replaceTransitionColors = (className: string): string => {
  return className.replace(/transition-colors/g, 'smooth-transition');
};

// Helper to add GPU acceleration to hover states
export const optimizeHoverState = (className: string): string => {
  if (className.includes('hover:')) {
    return `${className} gpu-accelerated`;
  }
  return className;
};