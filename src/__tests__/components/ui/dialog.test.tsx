import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog, DialogFooter } from '@/components/ui/dialog';

describe('Dialog', () => {
  it('should not render when closed', () => {
    render(<Dialog open={false} onClose={jest.fn()}><p>Content</p></Dialog>);
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<Dialog open={true} onClose={jest.fn()}><p>Dialog content</p></Dialog>);
    expect(screen.getByText('Dialog content')).toBeInTheDocument();
  });

  it('should have role dialog', () => {
    render(<Dialog open={true} onClose={jest.fn()}><p>Content</p></Dialog>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should have aria-modal', () => {
    render(<Dialog open={true} onClose={jest.fn()}><p>Content</p></Dialog>);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('should render title', () => {
    render(<Dialog open={true} onClose={jest.fn()} title="My Dialog"><p>Content</p></Dialog>);
    expect(screen.getByText('My Dialog')).toBeInTheDocument();
  });

  it('should render description', () => {
    render(
      <Dialog open={true} onClose={jest.fn()} title="Title" description="Description text">
        <p>Content</p>
      </Dialog>,
    );
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('should close on overlay click', () => {
    const onClose = jest.fn();
    render(<Dialog open={true} onClose={onClose}><p>Content</p></Dialog>);
    fireEvent.click(screen.getByTestId('overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close on close button click', () => {
    const onClose = jest.fn();
    render(<Dialog open={true} onClose={onClose}><p>Content</p></Dialog>);
    fireEvent.click(screen.getByTestId('close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close on Escape key', () => {
    const onClose = jest.fn();
    render(<Dialog open={true} onClose={onClose}><p>Content</p></Dialog>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should set body overflow to hidden when open', () => {
    render(<Dialog open={true} onClose={jest.fn()}><p>Content</p></Dialog>);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body overflow on close', () => {
    const { unmount } = render(<Dialog open={true} onClose={jest.fn()}><p>Content</p></Dialog>);
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('should apply size classes', () => {
    render(<Dialog open={true} onClose={jest.fn()} size="lg"><p>Content</p></Dialog>);
    const dialog = screen.getByRole('dialog').querySelector('.relative');
    expect(dialog?.className).toContain('max-w-2xl');
  });

  it('should accept custom className', () => {
    render(
      <Dialog open={true} onClose={jest.fn()} className="custom">
        <p>Content</p>
      </Dialog>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('DialogFooter', () => {
  it('should render children', () => {
    render(
      <DialogFooter>
        <button>Cancel</button>
        <button>Save</button>
      </DialogFooter>,
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('should have flex layout', () => {
    render(
      <DialogFooter data-testid="footer">
        <button>Action</button>
      </DialogFooter>,
    );
    expect(screen.getByTestId('footer').className).toContain('flex');
    expect(screen.getByTestId('footer').className).toContain('justify-end');
  });
});
