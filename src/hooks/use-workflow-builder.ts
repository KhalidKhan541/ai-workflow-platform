import * as React from "react";

export interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  description?: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
  status: "idle" | "running" | "completed" | "error";
}

interface UseWorkflowBuilderOptions {
  initialSteps?: WorkflowStep[];
  initialConnections?: { from: string; to: string }[];
}

interface UseWorkflowBuilderReturn {
  steps: WorkflowStep[];
  connections: { from: string; to: string }[];
  selectedStepId: string | null;
  selectedStep: WorkflowStep | null;
  addStep: (type: string, x: number, y: number, name?: string) => void;
  updateStep: (id: string, updates: Partial<WorkflowStep>) => void;
  removeStep: (id: string) => void;
  duplicateStep: (id: string) => void;
  moveStep: (id: string, x: number, y: number) => void;
  selectStep: (id: string | null) => void;
  addConnection: (from: string, to: string) => void;
  removeConnection: (from: string, to: string) => void;
  clearSelection: () => void;
  clearAll: () => void;
}

function useWorkflowBuilder({
  initialSteps = [],
  initialConnections = [],
}: UseWorkflowBuilderOptions = {}): UseWorkflowBuilderReturn {
  const [steps, setSteps] = React.useState<WorkflowStep[]>(initialSteps);
  const [connections, setConnections] = React.useState<{ from: string; to: string }[]>(initialConnections);
  const [selectedStepId, setSelectedStepId] = React.useState<string | null>(null);

  const selectedStep = React.useMemo(
    () => steps.find((s) => s.id === selectedStepId) || null,
    [steps, selectedStepId]
  );

  const generateId = () => `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addStep = React.useCallback(
    (type: string, x: number, y: number, name?: string) => {
      const newStep: WorkflowStep = {
        id: generateId(),
        type,
        name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} Step`,
        x,
        y,
        config: {},
        status: "idle",
      };
      setSteps((prev) => [...prev, newStep]);
      setSelectedStepId(newStep.id);
      return newStep;
    },
    []
  );

  const updateStep = React.useCallback((id: string, updates: Partial<WorkflowStep>) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === id ? { ...step, ...updates } : step
      )
    );
  }, []);

  const removeStep = React.useCallback(
    (id: string) => {
      setSteps((prev) => prev.filter((s) => s.id !== id));
      setConnections((prev) => prev.filter((c) => c.from !== id && c.to !== id));
      if (selectedStepId === id) {
        setSelectedStepId(null);
      }
    },
    [selectedStepId]
  );

  const duplicateStep = React.useCallback(
    (id: string) => {
      const step = steps.find((s) => s.id === id);
      if (!step) return;

      const newStep: WorkflowStep = {
        ...step,
        id: generateId(),
        name: `${step.name} (Copy)`,
        x: step.x + 20,
        y: step.y + 20,
        status: "idle",
      };
      setSteps((prev) => [...prev, newStep]);
      setSelectedStepId(newStep.id);
    },
    [steps]
  );

  const moveStep = React.useCallback((id: string, x: number, y: number) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === id ? { ...step, x, y } : step
      )
    );
  }, []);

  const selectStep = React.useCallback((id: string | null) => {
    setSelectedStepId(id);
  }, []);

  const addConnection = React.useCallback(
    (from: string, to: string) => {
      if (from === to) return;
      const exists = connections.some((c) => c.from === from && c.to === to);
      if (!exists) {
        setConnections((prev) => [...prev, { from, to }]);
      }
    },
    [connections]
  );

  const removeConnection = React.useCallback((from: string, to: string) => {
    setConnections((prev) =>
      prev.filter((c) => !(c.from === from && c.to === to))
    );
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedStepId(null);
  }, []);

  const clearAll = React.useCallback(() => {
    setSteps([]);
    setConnections([]);
    setSelectedStepId(null);
  }, []);

  return {
    steps,
    connections,
    selectedStepId,
    selectedStep,
    addStep,
    updateStep,
    removeStep,
    duplicateStep,
    moveStep,
    selectStep,
    addConnection,
    removeConnection,
    clearSelection,
    clearAll,
  };
}

export { useWorkflowBuilder };
