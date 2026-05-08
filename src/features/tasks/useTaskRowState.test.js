import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskRowState } from './useTaskRowState.js';

describe('useTaskRowState', () => {
  it('initialises all state to default values', () => {
    const { result } = renderHook(() => useTaskRowState({ text: 'Initial title' }));
    expect(result.current.hover).toBe(false);
    expect(result.current.expanded).toBe(false);
    expect(result.current.showAssign).toBe(false);
    expect(result.current.assignTarget).toBe('__new__');
    expect(result.current.newProjName).toBe('');
    expect(result.current.editTitle).toBe('Initial title');
  });

  it('syncs editTitle when task.text is updated externally', () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTaskRowState({ text }),
      { initialProps: { text: 'Original' } }
    );
    rerender({ text: 'Updated by AI' });
    expect(result.current.editTitle).toBe('Updated by AI');
  });

  it('does not reset a local editTitle edit when task.text has not changed', () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTaskRowState({ text }),
      { initialProps: { text: 'Same title' } }
    );
    act(() => result.current.setEditTitle('local draft'));
    rerender({ text: 'Same title' }); // prop unchanged → effect should not re-run
    expect(result.current.editTitle).toBe('local draft');
  });

  it('exposes setters that update their respective state values', () => {
    const { result } = renderHook(() => useTaskRowState({ text: 'Task' }));
    act(() => result.current.setHover(true));
    expect(result.current.hover).toBe(true);
    act(() => result.current.setExpanded(true));
    expect(result.current.expanded).toBe(true);
    act(() => result.current.setShowAssign(true));
    expect(result.current.showAssign).toBe(true);
    act(() => result.current.setAssignTarget('proj-123'));
    expect(result.current.assignTarget).toBe('proj-123');
    act(() => result.current.setNewProjName('My New Project'));
    expect(result.current.newProjName).toBe('My New Project');
  });
});
