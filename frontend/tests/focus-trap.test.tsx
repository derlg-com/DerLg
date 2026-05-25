import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

function TestHarness({ enabled, onEscape }: { enabled: boolean; onEscape?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, enabled, onEscape);
  return (
    <div ref={ref} data-testid="container" tabIndex={-1}>
      <button data-testid="first">First</button>
      <button data-testid="middle">Middle</button>
      <button data-testid="last">Last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus to first focusable element when enabled', () => {
    const { getByTestId } = render(<TestHarness enabled={true} />);
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('does not auto-focus when disabled', () => {
    const previous = document.body;
    document.body.focus();
    render(<TestHarness enabled={false} />);
    expect(document.activeElement).toBe(previous);
  });

  it('wraps Tab from last back to first', () => {
    const { getByTestId } = render(<TestHarness enabled={true} />);
    const last = getByTestId('last');
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(getByTestId('container'), { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('wraps Shift+Tab from first back to last', () => {
    const { getByTestId } = render(<TestHarness enabled={true} />);
    fireEvent.keyDown(getByTestId('container'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByTestId('last'));
  });

  it('invokes onEscape when Escape is pressed', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<TestHarness enabled={true} onEscape={onEscape} />);
    fireEvent.keyDown(getByTestId('container'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
