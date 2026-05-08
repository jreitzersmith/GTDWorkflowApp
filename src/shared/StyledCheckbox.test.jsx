import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StyledCheckbox } from './StyledCheckbox.jsx';

describe('StyledCheckbox', () => {
  it('renders a ✓ indicator when checked', () => {
    render(<StyledCheckbox checked={true} onChange={vi.fn()} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('does not render a ✓ indicator when unchecked', () => {
    render(<StyledCheckbox checked={false} onChange={vi.fn()} />);
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
  });

  it('calls onChange when the hidden input is clicked', () => {
    const onChange = vi.fn();
    render(<StyledCheckbox checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('applies accentColor to the checked visual background', () => {
    const { container } = render(
      <StyledCheckbox checked={true} onChange={vi.fn()} accentColor="#ff0000" />
    );
    // The visual div is the second child of the wrapper (after the hidden input).
    const visualBox = container.firstChild.children[1];
    expect(visualBox.style.background).toBe('rgb(255, 0, 0)');
  });

  it('forwards extra props (e.g. onClick) to the hidden input', () => {
    const onClick = vi.fn();
    render(<StyledCheckbox checked={false} onChange={vi.fn()} onClick={onClick} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
