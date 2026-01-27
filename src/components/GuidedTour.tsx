'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Production Scheduler! 🎉',
    description: 'Let\'s take a quick tour to help you understand how to use the application effectively. This will only take a minute.',
    icon: CheckCircleIcon,
    position: 'center',
  },
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    description: 'This is your main dashboard. Here you\'ll see a summary of your production schedule, including products at risk and upcoming work.',
    icon: ChartBarIcon,
    targetPath: '/dashboard',
    position: 'center',
  },
  {
    id: 'schedule',
    title: 'Gantt Chart Schedule',
    description: 'The Schedule page shows a visual Gantt chart of all your products across work centers. You can see exactly when each job is scheduled to run.',
    icon: CalendarDaysIcon,
    targetPath: '/schedule',
    position: 'center',
  },
  {
    id: 'products',
    title: 'Product Management',
    description: 'View and manage all your products here. You can reorder priorities by dragging products, and see their scheduling status at a glance.',
    icon: ListBulletIcon,
    targetPath: '/products',
    position: 'center',
  },
  {
    id: 'work-centers',
    title: 'Work Centers',
    description: 'Work centers define where products are manufactured. Each work center has specific hours of operation that affect scheduling.',
    icon: BuildingOfficeIcon,
    targetPath: '/work-centers',
    position: 'center',
  },
  {
    id: 'settings',
    title: 'Settings & Configuration',
    description: 'Manage your Google Sheets connection, scheduling parameters, and team members here. Admins can also reconfigure sheets if needed.',
    icon: Cog6ToothIcon,
    targetPath: '/settings',
    position: 'center',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'That\'s the basics! Your data syncs automatically from Google Sheets. If you ever need help, check the settings page or contact your admin.',
    icon: CheckCircleIcon,
    position: 'center',
  },
];

interface GuidedTourProps {
  steps?: TourStep[];
  onComplete?: () => void;
  storageKey?: string;
  forceShow?: boolean;
}

export function GuidedTour({
  steps = DEFAULT_TOUR_STEPS,
  onComplete,
  storageKey = 'production-scheduler-tour-completed',
  forceShow = false,
}: GuidedTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Check if tour should be shown
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    const tourCompleted = localStorage.getItem(storageKey);
    if (!tourCompleted) {
      setIsVisible(true);
    }
  }, [storageKey, forceShow]);

  // Handle navigation to target path
  useEffect(() => {
    if (isNavigating && currentStep.targetPath && pathname !== currentStep.targetPath) {
      router.push(currentStep.targetPath);
    }
    // Small delay to allow navigation
    const timer = setTimeout(() => setIsNavigating(false), 500);
    return () => clearTimeout(timer);
  }, [isNavigating, currentStep.targetPath, pathname, router]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleComplete();
    } else {
      const nextStep = steps[currentStepIndex + 1];
      if (nextStep.targetPath && pathname !== nextStep.targetPath) {
        setIsNavigating(true);
      }
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [isLastStep, currentStepIndex, steps, pathname]);

  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      const prevStep = steps[currentStepIndex - 1];
      if (prevStep.targetPath && pathname !== prevStep.targetPath) {
        setIsNavigating(true);
      }
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [isFirstStep, currentStepIndex, steps, pathname]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
    onComplete?.();
    // Navigate to dashboard if not there
    if (pathname !== '/dashboard') {
      router.push('/dashboard');
    }
  }, [storageKey, onComplete, pathname, router]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;
      
      if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleNext, handlePrevious, handleSkip]);

  if (!isVisible) {
    return null;
  }

  const Icon = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Tour Card */}
      <div className="relative z-10 bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-100">
          <div 
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Icon */}
          {Icon && (
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Icon className="h-6 w-6 text-blue-600" />
            </div>
          )}

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {currentStep.title}
          </h3>

          {/* Description */}
          <p className="text-gray-600 leading-relaxed">
            {currentStep.description}
          </p>

          {/* Step Indicator */}
          <div className="flex justify-center gap-1.5 mt-6">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStepIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStepIndex
                    ? 'bg-blue-600'
                    : index < currentStepIndex
                    ? 'bg-blue-300'
                    : 'bg-gray-200'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            Skip tour
          </button>

          <div className="flex gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrevious}
                className="btn btn-secondary text-sm py-2 px-3"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="btn btn-primary text-sm py-2 px-3"
            >
              {isLastStep ? (
                <>
                  Get Started
                  <CheckCircleIcon className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRightIcon className="h-4 w-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close tour"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
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
  const { startTour, resetTour } = useTour();

  const handleClick = () => {
    resetTour();
    // Small delay to allow state update
    setTimeout(() => startTour(), 100);
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
