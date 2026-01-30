'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Tour from '@rc-component/tour';
import type { TourProps } from '@rc-component/tour';
import {
  XMarkIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  ListBulletIcon,
  Cog6ToothIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  icon?: React.ElementType;
  targetPath?: string; // If set, navigates to this path
  targetSelector?: string; // CSS selector to highlight
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  // For conditional steps based on template features
  requiresTemplate?: string | string[];  // Only show if using one of these templates
  excludeTemplate?: string | string[];   // Hide if using one of these templates
}

// Template feature mappings - what features each template supports
const TEMPLATE_FEATURES: Record<string, string[]> = {
  'basic': ['products', 'work-centers', 'schedule'],
  'standard': ['products', 'work-centers', 'schedule', 'holidays'],
  'advanced': ['products', 'work-centers', 'schedule', 'holidays', 'audit-log', 'sync-metadata'],
};

const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Production Scheduler! 🎉',
    description: 'Let\'s take a quick tour to help you get started. This will only take a minute.',
    icon: CheckCircleIcon,
    position: 'center',
  },
  {
    id: 'navigation',
    title: 'Navigation',
    description: 'Use the sidebar to switch between Dashboard, Schedule, Products, Work Centers, and Settings.',
    icon: ListBulletIcon,
    targetPath: '/dashboard',
    targetSelector: '[data-tour="navigation"]',
    position: 'right',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'See your production summary at a glance - products at risk, locked items, and work center status.',
    icon: ChartBarIcon,
    targetPath: '/dashboard',
    targetSelector: '[data-tour="dashboard-stats"]',
    position: 'bottom',
  },
  {
    id: 'schedule',
    title: 'Gantt Chart',
    description: 'View your production schedule visually. Drag jobs to reschedule, and see status at a glance.',
    icon: CalendarDaysIcon,
    targetPath: '/schedule',
    targetSelector: '[data-tour="gantt-chart"]',
    position: 'top',
  },
  {
    id: 'products',
    title: 'Product Management',
    description: 'Manage products here. Drag to reorder priorities, lock schedules, and track status.',
    icon: ListBulletIcon,
    targetPath: '/products',
    targetSelector: '[data-tour="products-table"]',
    position: 'top',
  },
  {
    id: 'work-centers',
    title: 'Work Centers',
    description: 'Configure your manufacturing stations and their operating hours.',
    icon: BuildingOfficeIcon,
    targetPath: '/work-centers',
    targetSelector: '[data-tour="work-centers-list"]',
    position: 'top',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Configure sync settings, manage team members, and adjust scheduling parameters.',
    icon: Cog6ToothIcon,
    targetPath: '/settings',
    targetSelector: '[data-tour="settings-panel"]',
    position: 'top',
  },
  {
    id: 'complete',
    title: 'You\'re Ready!',
    description: 'Your data syncs automatically from Google Sheets. Click Refresh anytime to get the latest data.',
    icon: CheckCircleIcon,
    position: 'center',
  },
];

interface GuidedTourProps {
  steps?: TourStep[];
  onComplete?: () => void;
  storageKey?: string;
  forceShow?: boolean;
  templateId?: string;  // Filter steps based on template
}

// Helper to filter steps based on template
function filterStepsByTemplate(steps: TourStep[], templateId?: string): TourStep[] {
  if (!templateId) return steps;
  
  return steps.filter(step => {
    // Check requiresTemplate - only show if current template matches
    if (step.requiresTemplate) {
      const required = Array.isArray(step.requiresTemplate) 
        ? step.requiresTemplate 
        : [step.requiresTemplate];
      if (!required.includes(templateId)) {
        return false;
      }
    }
    
    // Check excludeTemplate - hide if current template matches
    if (step.excludeTemplate) {
      const excluded = Array.isArray(step.excludeTemplate) 
        ? step.excludeTemplate 
        : [step.excludeTemplate];
      if (excluded.includes(templateId)) {
        return false;
      }
    }
    
    return true;
  });
}

// Custom tour panel with smaller, cleaner design
function TourPanel({
  step,
  current,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  step: TourStep;
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const Icon = step.icon;
  const isFirst = current === 0;
  const isLast = current === total - 1;

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-xs w-full border border-gray-200 overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div 
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>
      
      <div className="p-4">
        {/* Header with icon */}
        <div className="flex items-start gap-3 mb-2">
          {Icon && (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Icon className="h-4 w-4 text-blue-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900">{step.title}</h4>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-3">{step.description}</p>

        {/* Step indicator dots */}
        <div className="flex justify-center gap-1 mb-3">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === current ? 'bg-blue-600' : i < current ? 'bg-blue-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Skip
          </button>
          
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                <ArrowLeftIcon className="h-3 w-3 mr-1" />
                Back
              </button>
            )}
            <button
              onClick={onNext}
              className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              {isLast ? (
                <>
                  Done
                  <CheckCircleIcon className="h-3 w-3 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRightIcon className="h-3 w-3 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GuidedTour({
  steps = DEFAULT_TOUR_STEPS,
  onComplete,
  storageKey = 'production-scheduler-tour-completed',
  forceShow = false,
  templateId,
}: GuidedTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Filter steps based on template
  const filteredSteps = filterStepsByTemplate(steps, templateId);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentStep = filteredSteps[currentStepIndex];

  // Find and set target element
  useEffect(() => {
    if (!isOpen || !currentStep?.targetSelector) {
      setTargetElement(null);
      return;
    }

    // Wait a bit for DOM to be ready after navigation
    const timer = setTimeout(() => {
      const element = document.querySelector(currentStep.targetSelector!) as HTMLElement;
      setTargetElement(element || null);
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, currentStep, pathname]);

  // Check if tour should be shown
  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      return;
    }

    const tourCompleted = localStorage.getItem(storageKey);
    if (!tourCompleted) {
      // Small delay to let the page render first
      setTimeout(() => setIsOpen(true), 500);
    }
  }, [storageKey, forceShow]);

  // Navigate to step's target path if needed
  useEffect(() => {
    if (!isOpen || !currentStep) return;
    
    if (currentStep.targetPath && pathname !== currentStep.targetPath) {
      router.push(currentStep.targetPath);
    }
  }, [isOpen, currentStep, pathname, router]);

  const handleNext = useCallback(() => {
    if (currentStepIndex === filteredSteps.length - 1) {
      handleComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex, filteredSteps.length]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setIsOpen(false);
    onComplete?.();
    
    if (pathname !== '/dashboard') {
      router.push('/dashboard');
    }
  }, [storageKey, onComplete, pathname, router]);

  const handleClose = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen || !currentStep) {
    return null;
  }

  // Map position to rc-component/tour placement
  const getPlacement = (): TourProps['placement'] => {
    switch (currentStep.position) {
      case 'top': return 'top';
      case 'bottom': return 'bottom';
      case 'left': return 'left';
      case 'right': return 'right';
      case 'topLeft': return 'topLeft';
      case 'topRight': return 'topRight';
      case 'bottomLeft': return 'bottomLeft';
      case 'bottomRight': return 'bottomRight';
      default: return 'bottom';
    }
  };

  // For centered steps (no target), show a simple modal
  if (!targetElement || currentStep.position === 'center') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
        <div className="relative z-10">
          <TourPanel
            step={currentStep}
            current={currentStepIndex}
            total={filteredSteps.length}
            onPrev={handlePrev}
            onNext={handleNext}
            onClose={handleClose}
          />
        </div>
      </div>
    );
  }

  return (
    <Tour
      open={isOpen}
      onClose={handleClose}
      current={0}
      steps={[{
        target: () => targetElement,
        title: currentStep.title,
        description: currentStep.description,
        placement: getPlacement(),
      }]}
      renderPanel={() => (
        <TourPanel
          step={currentStep}
          current={currentStepIndex}
          total={filteredSteps.length}
          onPrev={handlePrev}
          onNext={handleNext}
          onClose={handleClose}
        />
      )}
      mask={{
        style: {
          boxShadow: 'inset 0 0 15px #333',
        },
        color: 'rgba(0, 0, 0, 0.5)',
      }}
      arrow={{
        pointAtCenter: true,
      }}
      animated
    />
  );
}

/**
 * Hook to manage tour state
 */
export function useTour(storageKey = 'production-scheduler-tour-completed') {
  const [showTour, setShowTour] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    setHasSeenTour(!!completed);
  }, [storageKey]);

  const startTour = useCallback(() => {
    setShowTour(true);
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setShowTour(false);
    setHasSeenTour(true);
  }, [storageKey]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasSeenTour(false);
  }, [storageKey]);

  return {
    showTour,
    hasSeenTour,
    startTour,
    completeTour,
    resetTour,
  };
}

/**
 * Button to restart the tour
 */
export function RestartTourButton({
  className = '',
}: {
  className?: string;
}) {
  const { resetTour } = useTour();

  const handleClick = () => {
    resetTour();
    // Reload the page to show the tour
    window.location.reload();
  };

  return (
    <button
      onClick={handleClick}
      className={`text-sm text-blue-600 hover:text-blue-700 hover:underline ${className}`}
    >
      Restart tour
    </button>
  );
}

export default GuidedTour;
