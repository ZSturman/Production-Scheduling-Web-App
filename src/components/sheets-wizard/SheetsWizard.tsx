'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  DocumentPlusIcon,
  TableCellsIcon,
  Cog6ToothIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { SHEETS_TEMPLATES, getDefaultTemplate, type SheetsTemplate } from '@/lib/sheetsTemplates';
import type { SheetsHealth } from '@/types/settings';

// Step types - combined sheets and columns into 'configure'
type WizardStep = 'template' | 'configure' | 'review';

interface SheetNameConfig {
  key: string;
  defaultName: string;
  customName: string;
  existsInSpreadsheet: boolean;
  willRename: boolean;
}

interface ColumnConfig {
  key: string;
  label: string;
  customLabel: string;
  required: boolean;
  enabled: boolean;
  existsInSheet: boolean;
  description: string;
}

interface SheetColumnConfigs {
  sheetKey: string;
  sheetName: string;
  columns: ColumnConfig[];
}

interface SheetsWizardProps {
  sheetsHealth?: SheetsHealth | null;
  existingSheetNames?: string[];
  existingHeaders?: Record<string, string[]>;
  onComplete: (config: WizardConfig) => Promise<void>;
  onCancel?: () => void;
  isEdit?: boolean;
}

export interface WizardConfig {
  templateId: string;
  sheets: {
    key: string;
    name: string;
    renamedFrom?: string;
  }[];
  columns: {
    sheetKey: string;
    columns: {
      key: string;
      label: string;
      enabled: boolean;
      renamedFrom?: string;
    }[];
  }[];
  addDefaultData: boolean;
  // Per-sheet default data options
  defaultDataOptions: {
    workCenters: boolean;
    holidays: boolean;
    settings: boolean;
  };
}

const STEPS: { id: WizardStep; name: string; icon: typeof DocumentPlusIcon }[] = [
  { id: 'template', name: 'Select Template', icon: DocumentPlusIcon },
  { id: 'configure', name: 'Configure Sheets', icon: TableCellsIcon },
  { id: 'review', name: 'Review & Apply', icon: CheckIcon },
];

export default function SheetsWizard({
  sheetsHealth,
  existingSheetNames = [],
  existingHeaders = {},
  onComplete,
  onCancel,
  isEdit = false,
}: SheetsWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<SheetsTemplate>(getDefaultTemplate());
  const [sheetConfigs, setSheetConfigs] = useState<SheetNameConfig[]>([]);
  const [columnConfigs, setColumnConfigs] = useState<SheetColumnConfigs[]>([]);
  const [addDefaultData, setAddDefaultData] = useState(true);
  const [defaultDataOptions, setDefaultDataOptions] = useState({
    workCenters: true,
    holidays: true,
    settings: true,
  });
  const [confirmRenames, setConfirmRenames] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize sheet configs when template changes
  useEffect(() => {
    const configs: SheetNameConfig[] = selectedTemplate.sheets.map(sheet => {
      const existsInSpreadsheet = existingSheetNames.includes(sheet.name);
      return {
        key: sheet.key,
        defaultName: sheet.name,
        customName: sheet.name,
        existsInSpreadsheet,
        willRename: false,
      };
    });
    setSheetConfigs(configs);

    // Initialize column configs
    const colConfigs: SheetColumnConfigs[] = selectedTemplate.sheets.map(sheet => {
      const existingHeadersForSheet = existingHeaders[sheet.name] || [];
      return {
        sheetKey: sheet.key,
        sheetName: sheet.name,
        columns: sheet.columns.map(col => ({
          key: col.key,
          label: col.label,
          customLabel: col.label,
          required: col.required,
          enabled: col.required || existingHeadersForSheet.includes(col.label),
          existsInSheet: existingHeadersForSheet.includes(col.label),
          description: col.description,
        })),
      };
    });
    setColumnConfigs(colConfigs);
  }, [selectedTemplate, existingSheetNames, existingHeaders]);

  // Check if a sheet name was changed
  const handleSheetNameChange = (key: string, newName: string) => {
    setSheetConfigs(prev => prev.map(config => {
      if (config.key !== key) return config;
      
      const willRename = config.existsInSpreadsheet && newName !== config.defaultName;
      return {
        ...config,
        customName: newName,
        willRename,
      };
    }));
  };

  // Check if a column label was changed
  const handleColumnLabelChange = (sheetKey: string, columnKey: string, newLabel: string) => {
    setColumnConfigs(prev => prev.map(sheetConfig => {
      if (sheetConfig.sheetKey !== sheetKey) return sheetConfig;
      
      return {
        ...sheetConfig,
        columns: sheetConfig.columns.map(col => {
          if (col.key !== columnKey) return col;
          return { ...col, customLabel: newLabel };
        }),
      };
    }));
  };

  // Toggle column enabled state
  const handleColumnToggle = (sheetKey: string, columnKey: string) => {
    setColumnConfigs(prev => prev.map(sheetConfig => {
      if (sheetConfig.sheetKey !== sheetKey) return sheetConfig;
      
      return {
        ...sheetConfig,
        columns: sheetConfig.columns.map(col => {
          if (col.key !== columnKey || col.required) return col;
          return { ...col, enabled: !col.enabled };
        }),
      };
    }));
  };

  // Toggle rename confirmation
  const handleConfirmRename = (key: string) => {
    setConfirmRenames(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Navigate between steps
  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
  };

  const goNext = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const goBack = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  // Check if can proceed to next step
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'template':
        return !!selectedTemplate;
      case 'configure':
        // All renamed sheets need confirmation + all required columns must be enabled
        const unconfirmedRenames = sheetConfigs.filter(s => s.willRename && !confirmRenames.has(s.key));
        const requiredColumnsEnabled = columnConfigs.every(sheet => 
          sheet.columns.filter(c => c.required).every(c => c.enabled)
        );
        return unconfirmedRenames.length === 0 && requiredColumnsEnabled;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  // Submit the wizard
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const config: WizardConfig = {
        templateId: selectedTemplate.id,
        sheets: sheetConfigs.map(s => ({
          key: s.key,
          name: s.customName,
          renamedFrom: s.willRename ? s.defaultName : undefined,
        })),
        columns: columnConfigs.map(sc => ({
          sheetKey: sc.sheetKey,
          columns: sc.columns.map(c => ({
            key: c.key,
            label: c.customLabel,
            enabled: c.enabled,
            renamedFrom: c.customLabel !== c.label && c.existsInSheet ? c.label : undefined,
          })),
        })),
        addDefaultData,
        defaultDataOptions,
      };
      
      await onComplete(config);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'template':
        return <TemplateStep 
          templates={SHEETS_TEMPLATES}
          selected={selectedTemplate}
          onSelect={setSelectedTemplate}
          onUseDefaults={goNext}
        />;
      case 'configure':
        return <CombinedConfigureStep
          sheetConfigs={sheetConfigs}
          columnConfigs={columnConfigs}
          confirmRenames={confirmRenames}
          onSheetNameChange={handleSheetNameChange}
          onConfirmRename={handleConfirmRename}
          onColumnLabelChange={handleColumnLabelChange}
          onColumnToggle={handleColumnToggle}
        />;
      case 'review':
        return <ReviewStep
          template={selectedTemplate}
          sheetConfigs={sheetConfigs}
          columnConfigs={columnConfigs}
          addDefaultData={addDefaultData}
          onAddDefaultDataChange={setAddDefaultData}
          defaultDataOptions={defaultDataOptions}
          onDefaultDataOptionsChange={setDefaultDataOptions}
        />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Step indicator */}
      <div className="border-b border-gray-200 px-6 py-4">
        <nav className="flex justify-between">
          {STEPS.map((step, index) => {
            const isCurrent = step.id === currentStep;
            const isPast = STEPS.findIndex(s => s.id === currentStep) > index;
            const Icon = step.icon;
            
            return (
              <button
                key={step.id}
                onClick={() => isPast && goToStep(step.id)}
                disabled={!isPast && !isCurrent}
                className={`flex items-center ${isPast ? 'cursor-pointer' : ''}`}
              >
                <span className={`
                  flex items-center justify-center w-8 h-8 rounded-full mr-2
                  ${isCurrent ? 'bg-blue-600 text-white' : 
                    isPast ? 'bg-green-500 text-white' : 
                    'bg-gray-200 text-gray-500'}
                `}>
                  {isPast ? (
                    <CheckCircleIcon className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </span>
                <span className={`text-sm font-medium hidden sm:inline ${
                  isCurrent ? 'text-blue-600' : 
                  isPast ? 'text-green-600' : 
                  'text-gray-500'
                }`}>
                  {step.name}
                </span>
                {index < STEPS.length - 1 && (
                  <ArrowRightIcon className="w-4 h-4 mx-2 text-gray-300 hidden md:inline" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Step content */}
      <div className="p-6 min-h-[400px]">
        {renderStepContent()}
      </div>

      {/* Navigation buttons */}
      <div className="border-t border-gray-200 px-6 py-4 flex justify-between">
        <div>
          {currentStep !== 'template' && (
            <button
              onClick={goBack}
              className="btn btn-secondary flex items-center"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </button>
          )}
        </div>
        
        <div className="flex gap-3">
          {onCancel && (
            <button onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
          )}
          
          {currentStep === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="btn btn-primary flex items-center"
            >
              {isSubmitting ? 'Applying...' : 'Apply Configuration'}
              {!isSubmitting && <CheckIcon className="w-4 h-4 ml-2" />}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className="btn btn-primary flex items-center"
            >
              Next
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step Components
// ============================================================================

function TemplateStep({ 
  templates, 
  selected, 
  onSelect,
  onUseDefaults,
}: { 
  templates: SheetsTemplate[];
  selected: SheetsTemplate;
  onSelect: (template: SheetsTemplate) => void;
  onUseDefaults: () => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Select a Template</h2>
      <p className="text-gray-600 mb-6">
        Choose a template that matches your use case. Each template comes with predefined sheets and columns optimized for specific workflows.
      </p>
      
      <div className="grid gap-4">
        {templates.map(template => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className={`
              text-left p-4 rounded-lg border-2 transition-all
              ${selected.id === template.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'}
            `}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{template.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {template.sheets.map(sheet => (
                    <span 
                      key={sheet.key}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                    >
                      {sheet.name}
                    </span>
                  ))}
                </div>
              </div>
              {selected.id === template.id && (
                <CheckCircleIcon className="w-6 h-6 text-blue-500 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>
      
      {/* Quick action - Use defaults button */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-blue-900">Quick Setup</h4>
            <p className="text-sm text-blue-700 mt-1">
              Use the default sheet names and columns for the selected template.
            </p>
          </div>
          <button
            onClick={onUseDefaults}
            className="btn btn-primary btn-sm whitespace-nowrap"
          >
            Use Defaults →
          </button>
        </div>
      </div>
      
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          <InformationCircleIcon className="w-4 h-4 inline mr-1" />
          More templates will be available in future updates. Currently, the Production Scheduling template is optimized for manufacturing workflows.
        </p>
      </div>
    </div>
  );
}

// Combined Configure Step - replaces separate SheetsStep and ColumnsStep
function CombinedConfigureStep({
  sheetConfigs,
  columnConfigs,
  confirmRenames,
  onSheetNameChange,
  onConfirmRename,
  onColumnLabelChange,
  onColumnToggle,
}: {
  sheetConfigs: SheetNameConfig[];
  columnConfigs: SheetColumnConfigs[];
  confirmRenames: Set<string>;
  onSheetNameChange: (key: string, name: string) => void;
  onConfirmRename: (key: string) => void;
  onColumnLabelChange: (sheetKey: string, columnKey: string, label: string) => void;
  onColumnToggle: (sheetKey: string, columnKey: string) => void;
}) {
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Configure Sheets & Columns</h2>
      <p className="text-gray-600 mb-6">
        Click on a sheet to customize its name and column headers. Green checkmarks indicate items that already exist in your spreadsheet.
      </p>
      
      <div className="space-y-4">
        {sheetConfigs.map(sheetConfig => {
          const columnConfig = columnConfigs.find(c => c.sheetKey === sheetConfig.key);
          const isExpanded = expandedSheet === sheetConfig.key;
          const enabledColumns = columnConfig?.columns.filter(c => c.enabled).length ?? 0;
          const totalColumns = columnConfig?.columns.length ?? 0;
          
          return (
            <div key={sheetConfig.key} className="border rounded-lg overflow-hidden">
              {/* Sheet header - clickable to expand */}
              <button
                onClick={() => setExpandedSheet(isExpanded ? null : sheetConfig.key)}
                className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {sheetConfig.existsInSpreadsheet ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500" title="Sheet exists" />
                  ) : (
                    <DocumentPlusIcon className="w-5 h-5 text-gray-400" title="Will be created" />
                  )}
                  <div className="text-left">
                    <span className="font-medium text-gray-900">{sheetConfig.customName}</span>
                    {sheetConfig.willRename && (
                      <span className="ml-2 text-xs text-yellow-600">
                        (renaming from "{sheetConfig.defaultName}")
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {enabledColumns} / {totalColumns} columns
                  </span>
                  <ArrowRightIcon className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>
              
              {/* Expanded content */}
              {isExpanded && (
                <div className="p-4 border-t border-gray-200 space-y-4">
                  {/* Sheet name input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sheet Name
                    </label>
                    <input
                      type="text"
                      value={sheetConfig.customName}
                      onChange={(e) => onSheetNameChange(sheetConfig.key, e.target.value)}
                      className="input w-full max-w-sm"
                      placeholder={sheetConfig.defaultName}
                    />
                    
                    {/* Rename warning */}
                    {sheetConfig.willRename && (
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg max-w-lg">
                        <div className="flex items-start">
                          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-yellow-800">
                              This will rename the existing sheet in Google Sheets.
                            </p>
                            <label className="flex items-center mt-2">
                              <input
                                type="checkbox"
                                checked={confirmRenames.has(sheetConfig.key)}
                                onChange={() => onConfirmRename(sheetConfig.key)}
                                className="rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
                              />
                              <span className="ml-2 text-sm text-yellow-700">
                                I understand and want to rename this sheet
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!sheetConfig.existsInSpreadsheet && (
                      <p className="mt-1 text-xs text-gray-500">
                        This sheet will be created with default headers
                      </p>
                    )}
                  </div>
                  
                  {/* Columns section */}
                  {columnConfig && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Column Headers</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {columnConfig.columns.map(column => (
                          <div 
                            key={column.key}
                            className={`flex items-start gap-3 p-2 rounded ${
                              column.enabled ? 'bg-white border' : 'bg-gray-50'
                            }`}
                          >
                            {/* Enable checkbox */}
                            <input
                              type="checkbox"
                              checked={column.enabled}
                              onChange={() => onColumnToggle(sheetConfig.key, column.key)}
                              disabled={column.required}
                              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                              title={column.required ? 'Required column' : 'Toggle column'}
                            />
                            
                            {/* Column info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="text"
                                  value={column.customLabel}
                                  onChange={(e) => onColumnLabelChange(sheetConfig.key, column.key, e.target.value)}
                                  disabled={!column.enabled}
                                  className="input text-sm py-1 w-48"
                                />
                                {column.required && (
                                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                    Required
                                  </span>
                                )}
                                {column.existsInSheet && (
                                  <CheckCircleIcon className="w-4 h-4 text-green-500" title="Exists in sheet" />
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{column.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Keep SheetsStep for backwards compatibility but it's no longer used
function SheetsStep({
  configs,
  confirmRenames,
  onNameChange,
  onConfirmRename,
}: {
  configs: SheetNameConfig[];
  confirmRenames: Set<string>;
  onNameChange: (key: string, name: string) => void;
  onConfirmRename: (key: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Configure Sheet Names</h2>
      <p className="text-gray-600 mb-6">
        Customize the names of your sheets. Green checkmarks indicate sheets that already exist in your spreadsheet.
      </p>
      
      <div className="space-y-4">
        {configs.map(config => (
          <div key={config.key} className="border rounded-lg p-4">
            <div className="flex items-start gap-4">
              {/* Status indicator */}
              <div className="flex-shrink-0 pt-2">
                {config.existsInSpreadsheet ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-500" title="Sheet exists" />
                ) : (
                  <DocumentPlusIcon className="w-5 h-5 text-gray-400" title="Will be created" />
                )}
              </div>
              
              {/* Name input */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {config.key.charAt(0).toUpperCase() + config.key.slice(1)} Sheet
                </label>
                <input
                  type="text"
                  value={config.customName}
                  onChange={(e) => onNameChange(config.key, e.target.value)}
                  className="input w-full"
                  placeholder={config.defaultName}
                />
                
                {/* Rename warning */}
                {config.willRename && (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-yellow-800">
                          This will rename the existing &quot;{config.defaultName}&quot; sheet in Google Sheets to &quot;{config.customName}&quot;.
                        </p>
                        <label className="flex items-center mt-2">
                          <input
                            type="checkbox"
                            checked={confirmRenames.has(config.key)}
                            onChange={() => onConfirmRename(config.key)}
                            className="rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
                          />
                          <span className="ml-2 text-sm text-yellow-700">
                            I understand and want to rename this sheet
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* New sheet info */}
                {!config.existsInSpreadsheet && (
                  <p className="mt-1 text-xs text-gray-500">
                    This sheet will be created with default headers
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColumnsStep({
  configs,
  onLabelChange,
  onToggle,
}: {
  configs: SheetColumnConfigs[];
  onLabelChange: (sheetKey: string, columnKey: string, label: string) => void;
  onToggle: (sheetKey: string, columnKey: string) => void;
}) {
  const [expandedSheet, setExpandedSheet] = useState<string>(configs[0]?.sheetKey || '');

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Configure Column Headers</h2>
      <p className="text-gray-600 mb-6">
        Required columns are essential for the app to function. Optional columns can be enabled or disabled based on your needs.
      </p>
      
      <div className="space-y-4">
        {configs.map(sheetConfig => (
          <div key={sheetConfig.sheetKey} className="border rounded-lg overflow-hidden">
            {/* Sheet header */}
            <button
              onClick={() => setExpandedSheet(
                expandedSheet === sheetConfig.sheetKey ? '' : sheetConfig.sheetKey
              )}
              className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100"
            >
              <span className="font-medium">{sheetConfig.sheetName}</span>
              <span className="text-sm text-gray-500">
                {sheetConfig.columns.filter(c => c.enabled).length} / {sheetConfig.columns.length} columns
              </span>
            </button>
            
            {/* Column list */}
            {expandedSheet === sheetConfig.sheetKey && (
              <div className="p-4 space-y-3">
                {sheetConfig.columns.map(column => (
                  <div 
                    key={column.key}
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      column.enabled ? 'bg-white border' : 'bg-gray-50'
                    }`}
                  >
                    {/* Enable checkbox */}
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={column.enabled}
                        onChange={() => onToggle(sheetConfig.sheetKey, column.key)}
                        disabled={column.required}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        title={column.required ? 'Required column cannot be disabled' : 'Toggle column'}
                      />
                    </div>
                    
                    {/* Column info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={column.customLabel}
                          onChange={(e) => onLabelChange(sheetConfig.sheetKey, column.key, e.target.value)}
                          disabled={!column.enabled}
                          className="input text-sm py-1"
                        />
                        {column.required && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            Required
                          </span>
                        )}
                        {column.existsInSheet && (
                          <CheckCircleIcon className="w-4 h-4 text-green-500" title="Exists in sheet" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{column.description}</p>
                      
                      {/* Rename warning */}
                      {column.customLabel !== column.label && column.existsInSheet && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠️ This will update the header in Google Sheets
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewStep({
  template,
  sheetConfigs,
  columnConfigs,
  addDefaultData,
  onAddDefaultDataChange,
  defaultDataOptions,
  onDefaultDataOptionsChange,
}: {
  template: SheetsTemplate;
  sheetConfigs: SheetNameConfig[];
  columnConfigs: SheetColumnConfigs[];
  addDefaultData: boolean;
  onAddDefaultDataChange: (value: boolean) => void;
  defaultDataOptions: { workCenters: boolean; holidays: boolean; settings: boolean };
  onDefaultDataOptionsChange: (options: { workCenters: boolean; holidays: boolean; settings: boolean }) => void;
}) {
  const sheetsToCreate = sheetConfigs.filter(s => !s.existsInSpreadsheet);
  const sheetsToRename = sheetConfigs.filter(s => s.willRename);
  const columnsToAdd: { sheet: string; columns: string[] }[] = [];
  const columnsToRename: { sheet: string; from: string; to: string }[] = [];

  columnConfigs.forEach(sc => {
    const newCols = sc.columns.filter(c => c.enabled && !c.existsInSheet);
    if (newCols.length > 0) {
      columnsToAdd.push({ sheet: sc.sheetName, columns: newCols.map(c => c.customLabel) });
    }
    
    sc.columns.forEach(c => {
      if (c.customLabel !== c.label && c.existsInSheet) {
        columnsToRename.push({ sheet: sc.sheetName, from: c.label, to: c.customLabel });
      }
    });
  });

  const hasChanges = sheetsToCreate.length > 0 || sheetsToRename.length > 0 || 
                     columnsToAdd.length > 0 || columnsToRename.length > 0;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Review Configuration</h2>
      <p className="text-gray-600 mb-6">
        Review the changes that will be applied to your Google Sheets spreadsheet.
      </p>
      
      <div className="space-y-6">
        {/* Template info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900">Template: {template.name}</h3>
          <p className="text-sm text-blue-700 mt-1">{template.description}</p>
        </div>

        {/* Changes summary */}
        {hasChanges ? (
          <div className="space-y-4">
            {/* Sheets to create */}
            {sheetsToCreate.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">
                  <DocumentPlusIcon className="w-5 h-5 inline mr-2 text-green-500" />
                  Sheets to Create ({sheetsToCreate.length})
                </h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  {sheetsToCreate.map(s => (
                    <li key={s.key}>• {s.customName}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sheets to rename */}
            {sheetsToRename.length > 0 && (
              <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                <h3 className="font-medium text-yellow-900 mb-2">
                  <ExclamationTriangleIcon className="w-5 h-5 inline mr-2 text-yellow-500" />
                  Sheets to Rename ({sheetsToRename.length})
                </h3>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {sheetsToRename.map(s => (
                    <li key={s.key}>• {s.defaultName} → {s.customName}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Columns to add */}
            {columnsToAdd.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">
                  <TableCellsIcon className="w-5 h-5 inline mr-2 text-green-500" />
                  Columns to Add
                </h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  {columnsToAdd.map((item, i) => (
                    <li key={i}>
                      • <span className="font-medium">{item.sheet}</span>: {item.columns.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Columns to rename */}
            {columnsToRename.length > 0 && (
              <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                <h3 className="font-medium text-yellow-900 mb-2">
                  <ExclamationTriangleIcon className="w-5 h-5 inline mr-2 text-yellow-500" />
                  Columns to Rename
                </h3>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {columnsToRename.map((item, i) => (
                    <li key={i}>
                      • <span className="font-medium">{item.sheet}</span>: {item.from} → {item.to}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-medium text-green-900">
              <CheckCircleIcon className="w-5 h-5 inline mr-2 text-green-500" />
              No Changes Required
            </h3>
            <p className="text-sm text-green-700 mt-1">
              Your spreadsheet already has all the required sheets and columns configured.
            </p>
          </div>
        )}

        {/* Default data options - per sheet */}
        {sheetsToCreate.length > 0 && (
          <div className="border rounded-lg p-4 space-y-4">
            <div>
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={addDefaultData}
                  onChange={(e) => {
                    onAddDefaultDataChange(e.target.checked);
                    // If unchecking main toggle, uncheck all options
                    if (!e.target.checked) {
                      onDefaultDataOptionsChange({
                        workCenters: false,
                        holidays: false,
                        settings: false,
                      });
                    } else {
                      // If checking main toggle, check all options
                      onDefaultDataOptionsChange({
                        workCenters: true,
                        holidays: true,
                        settings: true,
                      });
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                />
                <div className="ml-3">
                  <span className="font-medium text-gray-900">Add default data</span>
                  <p className="text-sm text-gray-600 mt-1">
                    Populate new sheets with sample data to help you get started quickly.
                  </p>
                </div>
              </label>
            </div>
            
            {addDefaultData && (
              <div className="ml-6 pl-4 border-l-2 border-gray-200 space-y-3">
                <p className="text-sm font-medium text-gray-700">Select which sheets to populate:</p>
                
                {/* Work Centers option */}
                {sheetsToCreate.some(s => s.key === 'workCenters') && (
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={defaultDataOptions.workCenters}
                      onChange={(e) => onDefaultDataOptionsChange({
                        ...defaultDataOptions,
                        workCenters: e.target.checked,
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="ml-2">
                      <span className="text-sm text-gray-900">Work Centers</span>
                      <p className="text-xs text-gray-500">Sample work centers (Assembly, QC, Shipping)</p>
                    </div>
                  </label>
                )}
                
                {/* Holidays option */}
                {sheetsToCreate.some(s => s.key === 'holidays') && (
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={defaultDataOptions.holidays}
                      onChange={(e) => onDefaultDataOptionsChange({
                        ...defaultDataOptions,
                        holidays: e.target.checked,
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="ml-2">
                      <span className="text-sm text-gray-900">Holidays</span>
                      <p className="text-xs text-gray-500">US federal holidays for the current year</p>
                    </div>
                  </label>
                )}
                
                {/* Settings option */}
                {sheetsToCreate.some(s => s.key === 'settings') && (
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={defaultDataOptions.settings}
                      onChange={(e) => onDefaultDataOptionsChange({
                        ...defaultDataOptions,
                        settings: e.target.checked,
                      })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                    />
                    <div className="ml-2">
                      <span className="text-sm text-gray-900">Settings</span>
                      <p className="text-xs text-gray-500">Default scheduling settings and sync interval</p>
                    </div>
                  </label>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
