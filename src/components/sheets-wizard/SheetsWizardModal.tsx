'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import SheetsWizard, { type WizardConfig } from './SheetsWizard';
import type { SheetsHealth } from '@/types/settings';

interface SheetsWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetsHealth?: SheetsHealth | null;
  existingSheetNames?: string[];
  existingHeaders?: Record<string, string[]>;
  onComplete: (config: WizardConfig) => Promise<void>;
  isEdit?: boolean;
  /** If true, doesn't show close button (for first-time configuration) */
  required?: boolean;
}

export default function SheetsWizardModal({
  isOpen,
  onClose,
  sheetsHealth,
  existingSheetNames = [],
  existingHeaders = {},
  onComplete,
  isEdit = false,
  required = false,
}: SheetsWizardModalProps) {
  const handleComplete = async (config: WizardConfig) => {
    await onComplete(config);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="relative z-50" 
        onClose={required ? () => {} : onClose}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    {isEdit ? 'Configure Google Sheets' : 'Set Up Google Sheets'}
                  </Dialog.Title>
                  {!required && (
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-gray-500 transition-colors"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  )}
                </div>

                {/* Wizard Content */}
                <div className="max-h-[80vh] overflow-y-auto">
                  <SheetsWizard
                    sheetsHealth={sheetsHealth}
                    existingSheetNames={existingSheetNames}
                    existingHeaders={existingHeaders}
                    onComplete={handleComplete}
                    onCancel={required ? undefined : onClose}
                    isEdit={isEdit}
                  />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
