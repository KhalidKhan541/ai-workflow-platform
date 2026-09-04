import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowStep, WorkflowStepData } from '@/components/workflow/workflow-step';

describe('WorkflowStep', () => {
  const baseStep: WorkflowStepData = {
    id: 'step-1',
    type: 'action',
    name: 'Send Email',
    status: 'pending',
  };

  it('should render step name', () => {
    render(<WorkflowStep step={baseStep} index={0} />);
    expect(screen.getByText('Send Email')).toBeInTheDocument();
  });

  it('should render step index', () => {
    render(<WorkflowStep step={baseStep} index={2} />);
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('should render step type badge', () => {
    render(<WorkflowStep step={baseStep} index={0} />);
    expect(screen.getByText('action')).toBeInTheDocument();
  });

  it('should render connector when not last', () => {
    render(<WorkflowStep step={baseStep} index={0} isLast={false} />);
    expect(screen.getByTestId('connector')).toBeInTheDocument();
  });

  it('should not render connector when last', () => {
    render(<WorkflowStep step={baseStep} index={0} isLast={true} />);
    expect(screen.queryByTestId('connector')).not.toBeInTheDocument();
  });

  it('should handle click', () => {
    const onClick = jest.fn();
    render(<WorkflowStep step={baseStep} index={0} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('step-content'));
    expect(onClick).toHaveBeenCalledWith(baseStep);
  });

  it('should handle keyboard enter', () => {
    const onClick = jest.fn();
    render(<WorkflowStep step={baseStep} index={0} onClick={onClick} />);
    fireEvent.keyDown(screen.getByTestId('step-content'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalled();
  });

  it('should show selected state', () => {
    render(<WorkflowStep step={baseStep} index={0} isSelected={true} />);
    const content = screen.getByTestId('step-content');
    expect(content.className).toContain('border-blue-500');
  });

  it('should render status icon', () => {
    render(<WorkflowStep step={{ ...baseStep, status: 'success' }} index={0} />);
    expect(screen.getByTestId('step-status')).toHaveTextContent('●');
  });

  it('should render different status icons', () => {
    const { rerender } = render(<WorkflowStep step={{ ...baseStep, status: 'pending' }} index={0} />);
    expect(screen.getByTestId('step-status')).toHaveTextContent('○');
    rerender(<WorkflowStep step={{ ...baseStep, status: 'running' }} index={0} />);
    expect(screen.getByTestId('step-status')).toHaveTextContent('◐');
    rerender(<WorkflowStep step={{ ...baseStep, status: 'failed' }} index={0} />);
    expect(screen.getByTestId('step-status')).toHaveTextContent('✕');
  });

  it('should render config details', () => {
    const stepWithConfig = { ...baseStep, config: { url: 'http://api.test', method: 'POST' } };
    render(<WorkflowStep step={stepWithConfig} index={0} />);
    expect(screen.getByText(/url:/)).toBeInTheDocument();
    expect(screen.getByText(/method:/)).toBeInTheDocument();
  });

  it('should handle delete', () => {
    const onDelete = jest.fn();
    render(<WorkflowStep step={baseStep} index={0} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('delete-step'));
    expect(onDelete).toHaveBeenCalledWith('step-1');
  });

  it('should not propagate delete click to parent', () => {
    const onClick = jest.fn();
    const onDelete = jest.fn();
    render(<WorkflowStep step={baseStep} index={0} onClick={onClick} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('delete-step'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('should render different step types with correct colors', () => {
    const types: WorkflowStepData['type'][] = ['action', 'condition', 'delay', 'loop', 'parallel', 'ai'];
    types.forEach((type) => {
      const { unmount } = render(<WorkflowStep step={{ ...baseStep, type }} index={0} />);
      expect(screen.getByText(type)).toBeInTheDocument();
      unmount();
    });
  });

  it('should render step status in aria-label', () => {
    render(<WorkflowStep step={baseStep} index={0} />);
    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveAttribute('aria-label', expect.stringContaining('Send Email'));
  });
});
