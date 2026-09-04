import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('should render an input', () => {
    render(<Input />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('should link label to input via htmlFor', () => {
    render(<Input label="Username" />);
    const label = screen.getByText('Username');
    const input = screen.getByRole('textbox');
    expect(label).toHaveAttribute('for', 'username');
  });

  it('should display error message', () => {
    render(<Input error="Field is required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Field is required');
  });

  it('should set aria-invalid when error', () => {
    render(<Input error="Invalid" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('should display hint when no error', () => {
    render(<Input hint="Enter your email" />);
    expect(screen.getByText('Enter your email')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should not show hint when error present', () => {
    render(<Input error="Error" hint="Hint" />);
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
  });

  it('should handle value changes', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should render with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should render disabled state', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should render left addon', () => {
    render(<Input leftIcon={<span>🔍</span>} />);
    expect(screen.getByTestId('left-addon')).toBeInTheDocument();
  });

  it('should render right addon', () => {
    render(<Input rightIcon={<span>✓</span>} />);
    expect(screen.getByTestId('right-addon')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<Input className="custom" />);
    expect(screen.getByRole('textbox').className).toContain('custom');
  });

  it('should use custom id', () => {
    render(<Input id="custom-id" label="Test" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'custom-id');
  });

  it('should auto-generate id from label', () => {
    render(<Input label="First Name" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'first-name');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('should pass through input props', () => {
    render(<Input type="password" maxLength={50} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('maxlength', '50');
  });

  it('should have error styling on input', () => {
    render(<Input error="Error" />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-red-500');
  });

  it('should have normal styling without error', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input.className).toContain('border-gray-300');
  });
});
