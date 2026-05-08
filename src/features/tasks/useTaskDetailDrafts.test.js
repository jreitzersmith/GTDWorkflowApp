import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskDetailDrafts } from './useTaskDetailDrafts.js';

const makeTask = (overrides = {}) => ({
  id: 'task-1',
  text: 'Task title',
  notes: null,
  ...overrides,
});

describe('useTaskDetailDrafts', () => {
  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------
  it('initialises titleDraft and notesDraft from the task', () => {
    const { result } = renderHook(() =>
      useTaskDetailDrafts({
        task: makeTask({ notes: 'Some notes' }),
        onUpdate: vi.fn(),
        onClose: vi.fn(),
      })
    );
    expect(result.current.titleDraft).toBe('Task title');
    expect(result.current.notesDraft).toBe('Some notes');
  });

  it('defaults notesDraft to an empty string when task.notes is null', () => {
    const { result } = renderHook(() =>
      useTaskDetailDrafts({ task: makeTask(), onUpdate: vi.fn(), onClose: vi.fn() })
    );
    expect(result.current.notesDraft).toBe('');
  });

  // ---------------------------------------------------------------------------
  // Task-change sync effects
  // ---------------------------------------------------------------------------
  it('resets both drafts when the panel switches to a different task (id change)', () => {
    const { result, rerender } = renderHook(
      ({ task }) => useTaskDetailDrafts({ task, onUpdate: vi.fn(), onClose: vi.fn() }),
      { initialProps: { task: makeTask({ id: 'task-1', text: 'First task', notes: 'Note A' }) } }
    );

    act(() => result.current.setTitleDraft('edited title'));
    act(() => result.current.setNotesDraft('edited notes'));

    rerender({ task: makeTask({ id: 'task-2', text: 'Second task', notes: 'Note B' }) });

    expect(result.current.titleDraft).toBe('Second task');
    expect(result.current.notesDraft).toBe('Note B');
  });

  // ---------------------------------------------------------------------------
  // Escape-key listener
  // ---------------------------------------------------------------------------
  it('calls onClose when the Escape key is pressed', () => {
    const onClose = vi.fn();
    renderHook(() =>
      useTaskDetailDrafts({ task: makeTask(), onUpdate: vi.fn(), onClose })
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose for non-Escape keys', () => {
    const onClose = vi.fn();
    renderHook(() =>
      useTaskDetailDrafts({ task: makeTask(), onUpdate: vi.fn(), onClose })
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes the keydown listener when the component unmounts', () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() =>
      useTaskDetailDrafts({ task: makeTask(), onUpdate: vi.fn(), onClose })
    );
    unmount();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // saveTitle
  // ---------------------------------------------------------------------------
  it('saveTitle calls onUpdate when the title draft has changed', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useTaskDetailDrafts({ task: makeTask(), onUpdate, onClose: vi.fn() })
    );
    act(() => result.current.setTitleDraft('New title'));
    act(() => result.current.saveTitle());
    expect(onUpdate).toHaveBeenCalledWith('task-1', { text: 'New title' });
  });

  it('saveTitle does not call onUpdate when the title is unchanged', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useTaskDetailDrafts({ task: makeTask({ text: 'Original' }), onUpdate, onClose: vi.fn() })
    );
    act(() => result.current.saveTitle());
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('saveTitle reverts the draft to the task text when the title is unchanged', () => {
    const { result } = renderHook(() =>
      useTaskDetailDrafts({ task: makeTask({ text: 'Original' }), onUpdate: vi.fn(), onClose: vi.fn() })
    );
    act(() => result.current.setTitleDraft('  '));
    act(() => result.current.saveTitle());
    expect(result.current.titleDraft).toBe('Original');
  });

  // ---------------------------------------------------------------------------
  // saveNotes
  // ---------------------------------------------------------------------------
  it('saveNotes calls onUpdate when notes have changed', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useTaskDetailDrafts({ task: makeTask(), onUpdate, onClose: vi.fn() })
    );
    act(() => result.current.setNotesDraft('New notes'));
    act(() => result.current.saveNotes());
    expect(onUpdate).toHaveBeenCalledWith('task-1', { notes: 'New notes' });
  });

  it('saveNotes treats whitespace-only input as null', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useTaskDetailDrafts({ task: makeTask({ notes: 'Old notes' }), onUpdate, onClose: vi.fn() })
    );
    act(() => result.current.setNotesDraft('   '));
    act(() => result.current.saveNotes());
    expect(onUpdate).toHaveBeenCalledWith('task-1', { notes: null });
  });

  it('saveNotes does not call onUpdate when notes are unchanged', () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useTaskDetailDrafts({ task: makeTask({ notes: 'Existing note' }), onUpdate, onClose: vi.fn() })
    );
    act(() => result.current.saveNotes()); // notesDraft matches task.notes
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
