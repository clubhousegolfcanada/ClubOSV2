import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toggle from '@/components/Toggle';

describe('Toggle Component', () => {
  it('renders unchecked by default', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('renders checked when checked prop is true', () => {
    const onChange = jest.fn();
    render(<Toggle checked={true} onChange={onChange} />);
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('calls onChange when clicked', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    
    render(<Toggle checked={false} onChange={onChange} />);
    
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles from checked to unchecked', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    
    render(<Toggle checked={true} onChange={onChange} />);
    
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('renders with label when provided', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} label="Enable Feature" />);
    
    expect(screen.getByText('Enable Feature')).toBeInTheDocument();
  });

  it('renders without label when not provided', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    
    // Label element should still exist but no text
    const label = screen.getByRole('checkbox').closest('label');
    expect(label).toBeInTheDocument();
    expect(label).not.toHaveTextContent('Enable Feature');
  });

  it('is disabled when disabled prop is true', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} disabled={true} />);
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('does not call onChange when clicked while disabled', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    
    render(<Toggle checked={false} onChange={onChange} disabled={true} />);
    
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies correct styles when checked', () => {
    const onChange = jest.fn();
    const { container } = render(<Toggle checked={true} onChange={onChange} />);
    
    const track = container.querySelector('.bg-primary');
    expect(track).toBeInTheDocument();
    
    const thumb = container.querySelector('.translate-x-6');
    expect(thumb).toBeInTheDocument();
  });

  it('applies correct styles when unchecked', () => {
    const onChange = jest.fn();
    const { container } = render(<Toggle checked={false} onChange={onChange} />);
    
    const track = container.querySelector('.bg-gray-300');
    expect(track).toBeInTheDocument();
    
    const thumb = container.querySelector('.translate-x-6');
    expect(thumb).not.toBeInTheDocument();
  });

  it('applies disabled styles when disabled', () => {
    const onChange = jest.fn();
    const { container } = render(<Toggle checked={false} onChange={onChange} disabled={true} />);
    
    const track = container.querySelector('.opacity-50');
    expect(track).toBeInTheDocument();
  });

  it('maintains accessibility with screen reader only checkbox', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveClass('sr-only');
  });
});