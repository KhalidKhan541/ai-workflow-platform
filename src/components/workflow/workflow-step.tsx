import React from 'react';

export interface WorkflowStepData {
  id: string;
  type: 'action' | 'condition' | 'delay' | 'loop' | 'parallel' | 'ai';
  name: string;
  status?: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  config?: Record<string, unknown>;
}

export interface WorkflowStepProps {
  step: WorkflowStepData;
  index: number;
  isSelected?: boolean;
  isLast?: boolean;
  onClick?: (step: WorkflowStepData) => void;
  onDelete?: (stepId: string) => void;
}

const typeColors: Record<string, string> = {
  action: 'bg-blue-100 text-blue-800 border-blue-300',
  condition: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  delay: 'bg-purple-100 text-purple-800 border-purple-300',
  loop: 'bg-green-100 text-green-800 border-green-300',
  parallel: 'bg-orange-100 text-orange-800 border-orange-300',
  ai: 'bg-pink-100 text-pink-800 border-pink-300',
};

const statusIcons: Record<string, string> = {
  pending: '○',
  running: '◐',
  success: '●',
  failed: '✕',
  skipped: '—',
};

const typeIcons: Record<string, string> = {
  action: '⚡',
  condition: '◇',
  delay: '⏱',
  loop: '↻',
  parallel: '⟐',
  ai: '✦',
};

export function WorkflowStep({
  step,
  index,
  isSelected = false,
  isLast = false,
  onClick,
  onDelete,
}: WorkflowStepProps) {
  return (
    <div className="flex items-start" data-testid="workflow-step">
      <div className="flex flex-col items-center mr-4">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 ${
            typeColors[step.type]
          } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
          role="status"
          aria-label={`Step ${index + 1}: ${step.name}`}
        >
          {typeIcons[step.type]}
        </div>
        {!isLast && (
          <div className="w-0.5 h-8 bg-gray-300 mt-1" data-testid="connector" />
        )}
      </div>
      <div
        className={`flex-1 p-4 rounded-lg border cursor-pointer transition-all ${
          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
        onClick={() => onClick?.(step)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.(step)}
        data-testid="step-content"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">#{index + 1}</span>
            <h4 className="text-sm font-medium text-gray-900">{step.name}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[step.type]}`}>
              {step.type}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {step.status && (
              <span className="text-sm" data-testid="step-status" aria-label={`Status: ${step.status}`}>
                {statusIcons[step.status]}
              </span>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(step.id);
                }}
                className="text-gray-400 hover:text-red-600 text-sm"
                aria-label={`Delete step ${step.name}`}
                data-testid="delete-step"
              >
                ×
              </button>
            )}
          </div>
        </div>
        {step.config && Object.keys(step.config).length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            {Object.entries(step.config).map(([key, val]) => (
              <span key={key} className="mr-3">
                {key}: {typeof val === 'object' ? JSON.stringify(val) : String(val)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
