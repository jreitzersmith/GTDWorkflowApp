import { describe, it, expect, vi } from 'vitest';
import {
  effortToMinutes,
  minutesToEffortLabel,
  collectDescendantIds,
  getOrderedChildren,
  waterfallFilter,
  moveTaskInTree,
  extractCreateAction,
  extractUpdateAction,
  extractAddAction,
  extractSuggestions,
  extractMetadata,
} from './taskUtils.jsx';

// Mock external dependencies so the module loads cleanly in the test environment.
vi.mock('../calendar/calendarApi.js', () => ({
  genId: () => 'mock-id',
  parseRecurrenceValue: (val) => ({ raw: val }),
}));

vi.mock('../../constants.jsx', () => ({
  COLORS: { effort: '#6ec6a8' },
}));

// ---------------------------------------------------------------------------
// effortToMinutes
// ---------------------------------------------------------------------------
describe('effortToMinutes', () => {
  it('parses compact minute notation', () => expect(effortToMinutes('30m')).toBe(30));
  it('parses compact hour notation', () => expect(effortToMinutes('2h')).toBe(120));
  it('parses compact day notation (1 calendar day = 1440 min)', () => expect(effortToMinutes('1d')).toBe(1440));
  it('parses compact week notation', () => expect(effortToMinutes('1w')).toBe(10080));
  it('parses compact month notation', () => expect(effortToMinutes('1mo')).toBe(43200));
  it('parses fractional compact values', () => expect(effortToMinutes('1.5h')).toBe(90));
  it('parses long-form "30 min"', () => expect(effortToMinutes('30 min')).toBe(30));
  it('parses long-form "2 hours"', () => expect(effortToMinutes('2 hours')).toBe(120));
  it('parses long-form "1 day"', () => expect(effortToMinutes('1 day')).toBe(1440));
  it('parses long-form "1 week"', () => expect(effortToMinutes('1 week')).toBe(10080));
  it('parses long-form "1 month"', () => expect(effortToMinutes('1 month')).toBe(43200));
  it('returns 0 for an empty string', () => expect(effortToMinutes('')).toBe(0));
  it('returns 0 for null', () => expect(effortToMinutes(null)).toBe(0));
  it('returns 0 for an unrecognised string', () => expect(effortToMinutes('foobar')).toBe(0));
  it('is case-insensitive', () => expect(effortToMinutes('2H')).toBe(120));
});

// ---------------------------------------------------------------------------
// minutesToEffortLabel
// ---------------------------------------------------------------------------
describe('minutesToEffortLabel', () => {
  it('returns null for 0', () => expect(minutesToEffortLabel(0)).toBeNull());
  it('returns null for null', () => expect(minutesToEffortLabel(null)).toBeNull());
  it('returns null for negative values', () => expect(minutesToEffortLabel(-5)).toBeNull());
  it('formats sub-hour minutes as Xm', () => expect(minutesToEffortLabel(30)).toBe('30m'));
  it('formats 60 minutes as 1h', () => expect(minutesToEffortLabel(60)).toBe('1h'));
  it('formats 90 minutes as 1.5h', () => expect(minutesToEffortLabel(90)).toBe('1.5h'));
  it('formats 480 minutes as 1d', () => expect(minutesToEffortLabel(480)).toBe('1d'));
  it('formats 2400 minutes as 1w', () => expect(minutesToEffortLabel(2400)).toBe('1w'));
  it('formats 9600 minutes as 1mo', () => expect(minutesToEffortLabel(9600)).toBe('1mo'));
});

// ---------------------------------------------------------------------------
// collectDescendantIds
// ---------------------------------------------------------------------------
describe('collectDescendantIds', () => {
  const tasks = [
    { id: 'a', childIds: ['b', 'c'] },
    { id: 'b', childIds: ['d'] },
    { id: 'c', childIds: [] },
    { id: 'd', childIds: [] },
    { id: 'e', childIds: [] },
  ];

  it('collects self and all descendants recursively', () => {
    const result = collectDescendantIds('a', tasks);
    expect(result).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('returns a set containing only self when the task has no children', () => {
    expect(collectDescendantIds('e', tasks)).toEqual(new Set(['e']));
  });

  it('handles a missing task gracefully — returns set with just the id', () => {
    expect(collectDescendantIds('z', tasks)).toEqual(new Set(['z']));
  });

  it('does not infinite-loop on circular childIds references', () => {
    const cyclic = [
      { id: 'x', childIds: ['y'] },
      { id: 'y', childIds: ['x'] },
    ];
    const result = collectDescendantIds('x', cyclic);
    expect(result.has('x')).toBe(true);
    expect(result.has('y')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getOrderedChildren
// ---------------------------------------------------------------------------
describe('getOrderedChildren', () => {
  const tasks = [
    { id: 'proj-1', bucket: 'project', childIds: ['child-b', 'child-a'] },
    { id: 'proj-2', bucket: 'project', childIds: [] },
    { id: 'child-a', bucket: 'next', parentId: 'proj-1' },
    { id: 'child-b', bucket: 'next', parentId: 'proj-1' },
    { id: 'orphan', bucket: 'next' },
  ];

  it('returns all root projects when parentId is null', () => {
    const result = getOrderedChildren(null, tasks);
    expect(result.map(t => t.id)).toEqual(['proj-1', 'proj-2']);
  });

  it('returns children in the order specified by parent.childIds', () => {
    const result = getOrderedChildren('proj-1', tasks);
    expect(result.map(t => t.id)).toEqual(['child-b', 'child-a']);
  });

  it('returns an empty array when the parent has no children', () => {
    expect(getOrderedChildren('proj-2', tasks)).toEqual([]);
  });

  it('returns an empty array for an unknown parentId', () => {
    expect(getOrderedChildren('nonexistent', tasks)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// waterfallFilter
// ---------------------------------------------------------------------------
describe('waterfallFilter', () => {
  it('includes tasks that have no next-bucket children', () => {
    const allTasks = [
      { id: 'parent', bucket: 'next', done: false },
      { id: 'child', bucket: 'inbox', parentId: 'parent', done: false },
    ];
    const result = waterfallFilter([allTasks[0]], allTasks);
    expect(result).toHaveLength(1);
  });

  it('excludes tasks that have at least one incomplete next-bucket child', () => {
    const allTasks = [
      { id: 'parent', bucket: 'next', done: false },
      { id: 'child', bucket: 'next', parentId: 'parent', done: false },
    ];
    expect(waterfallFilter([allTasks[0]], allTasks)).toHaveLength(0);
  });

  it('includes tasks whose next-bucket children are all done', () => {
    const allTasks = [
      { id: 'parent', bucket: 'next', done: false },
      { id: 'child', bucket: 'next', parentId: 'parent', done: true },
    ];
    expect(waterfallFilter([allTasks[0]], allTasks)).toHaveLength(1);
  });

  it('returns an empty array for an empty input', () => {
    expect(waterfallFilter([], [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractCreateAction
// ---------------------------------------------------------------------------
describe('extractCreateAction', () => {
  it('parses a minimal create action', () => {
    const result = extractCreateAction('→ACTION:create|Buy groceries|bucket:inbox');
    expect(result).toEqual({ title: 'Buy groceries', bucket: 'inbox' });
  });

  it('strips bracket characters from the title', () => {
    const result = extractCreateAction('→ACTION:create|[Do the thing]|bucket:next');
    expect(result).toEqual({ title: 'Do the thing', bucket: 'next' });
  });

  it('parses optional fields alongside bucket', () => {
    const result = extractCreateAction('→ACTION:create|Task title|bucket:next|due:2026-06-01|effort:1h');
    expect(result).toMatchObject({
      title: 'Task title',
      bucket: 'next',
      dueDate: '2026-06-01',
      effort: '1h',
    });
  });

  it('parses location as an array', () => {
    const result = extractCreateAction('→ACTION:create|Task|bucket:inbox|location:Home,Office');
    expect(result).toMatchObject({ location: ['Home', 'Office'] });
  });

  it('returns null for an unrecognised bucket value', () => {
    expect(extractCreateAction('→ACTION:create|Task|bucket:invalid')).toBeNull();
  });

  it('returns null when no action line is present', () => {
    expect(extractCreateAction('Some regular text')).toBeNull();
  });

  it('returns null when title is empty', () => {
    expect(extractCreateAction('→ACTION:create||bucket:inbox')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractUpdateAction
// ---------------------------------------------------------------------------
describe('extractUpdateAction', () => {
  it('parses a single due-date field', () => {
    const result = extractUpdateAction('→ACTION:update|task-1|due:2026-06-01');
    expect(result).toEqual({ taskId: 'task-1', changes: { dueDate: '2026-06-01' } });
  });

  it('strips bracket characters from title values', () => {
    const result = extractUpdateAction('→ACTION:update|task-1|title:[New Title]');
    expect(result).toEqual({ taskId: 'task-1', changes: { text: 'New Title' } });
  });

  it('parses notes and converts escaped newlines', () => {
    const result = extractUpdateAction('→ACTION:update|task-1|notes:Line one\\nLine two');
    expect(result).toEqual({ taskId: 'task-1', changes: { notes: 'Line one\nLine two' } });
  });

  it('parses multiple fields in a single action', () => {
    const result = extractUpdateAction('→ACTION:update|task-1|effort:2h|bucket:next');
    expect(result).toMatchObject({ taskId: 'task-1', changes: { effort: '2h', bucket: 'next' } });
  });

  it('parses priority as a trimmed array', () => {
    const result = extractUpdateAction('→ACTION:update|task-1|priority:high, urgent');
    expect(result).toMatchObject({ taskId: 'task-1', changes: { priority: ['high', 'urgent'] } });
  });

  it('returns null when no action line is present', () => {
    expect(extractUpdateAction('Some regular text')).toBeNull();
  });

  it('returns null when no recognised fields are present', () => {
    expect(extractUpdateAction('→ACTION:update|task-1|unknown:value')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractAddAction
// ---------------------------------------------------------------------------
describe('extractAddAction', () => {
  it('parses a child-task add action', () => {
    const result = extractAddAction('→ACTION:add|Child Task|parent:proj-1|bucket:next');
    expect(result).toEqual({ title: 'Child Task', parentId: 'proj-1', bucket: 'next' });
  });

  it('strips backticks and brackets from the title', () => {
    const result = extractAddAction('→ACTION:add|`[Sub-task]`|parent:proj-1|bucket:next');
    expect(result).toMatchObject({ title: 'Sub-task' });
  });

  it('returns null when the parent field is absent', () => {
    expect(extractAddAction('→ACTION:add|Child Task|bucket:next')).toBeNull();
  });

  it('returns null when no action line is present', () => {
    expect(extractAddAction('Some text')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractSuggestions
// ---------------------------------------------------------------------------
describe('extractSuggestions', () => {
  it('parses numbered suggestions', () => {
    const text = 'Preamble\n→SUGGESTIONS:\n1. First suggestion\n2. Second suggestion';
    expect(extractSuggestions(text)).toEqual(['First suggestion', 'Second suggestion']);
  });

  it('parses bullet suggestions', () => {
    const text = '→SUGGESTIONS:\n- Item A\n- Item B';
    expect(extractSuggestions(text)).toEqual(['Item A', 'Item B']);
  });

  it('accepts the ASCII -> prefix', () => {
    const text = '->SUGGESTIONS:\n1. An item';
    expect(extractSuggestions(text)).toEqual(['An item']);
  });

  it('filters out "(none)" placeholder lines', () => {
    expect(extractSuggestions('→SUGGESTIONS:\n(none)')).toEqual([]);
  });

  it('returns an empty array when no block is present', () => {
    expect(extractSuggestions('No suggestions here')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractMetadata
// ---------------------------------------------------------------------------
describe('extractMetadata', () => {
  it('parses effort and due-date fields', () => {
    const text = '→METADATA:\ntask-1|effort:2h|due:2026-06-01';
    expect(extractMetadata(text)).toEqual([
      { taskId: 'task-1', fields: { effort: '2h', dueDate: '2026-06-01' } },
    ]);
  });

  it('parses the defer field', () => {
    const text = '→METADATA:\ntask-1|defer:2026-07-01';
    expect(extractMetadata(text)).toEqual([
      { taskId: 'task-1', fields: { deferUntil: '2026-07-01' } },
    ]);
  });

  it('filters out lines with no recognised fields', () => {
    expect(extractMetadata('→METADATA:\ntask-1|unknown:value')).toEqual([]);
  });

  it('returns an empty array when no block is present', () => {
    expect(extractMetadata('No metadata')).toEqual([]);
  });

  it('accepts the ASCII -> prefix', () => {
    const text = '->METADATA:\ntask-1|effort:1h';
    expect(extractMetadata(text)).toEqual([{ taskId: 'task-1', fields: { effort: '1h' } }]);
  });
});

// ---------------------------------------------------------------------------
// moveTaskInTree
// ---------------------------------------------------------------------------
describe('moveTaskInTree', () => {
  const baseTasks = [
    { id: 'proj-a', bucket: 'project', childIds: ['child-1', 'child-2'] },
    { id: 'proj-b', bucket: 'project', childIds: [] },
    { id: 'child-1', bucket: 'next', parentId: 'proj-a' },
    { id: 'child-2', bucket: 'next', parentId: 'proj-a' },
  ];

  it('returns the original array reference when drag and target are the same task', () => {
    const result = moveTaskInTree(baseTasks, 'proj-a', 'proj-a', 'before');
    expect(result).toBe(baseTasks);
  });

  it('reorders children within the same parent (before)', () => {
    const result = moveTaskInTree(baseTasks, 'child-2', 'child-1', 'before');
    const parent = result.find(t => t.id === 'proj-a');
    expect(parent.childIds).toEqual(['child-2', 'child-1']);
  });

  it('reorders children within the same parent (after)', () => {
    const result = moveTaskInTree(baseTasks, 'child-1', 'child-2', 'after');
    const parent = result.find(t => t.id === 'proj-a');
    expect(parent.childIds).toEqual(['child-2', 'child-1']);
  });

  it('reparents a child when dropped inside another project', () => {
    const result = moveTaskInTree(baseTasks, 'child-1', 'proj-b', 'inside');
    const movedChild = result.find(t => t.id === 'child-1');
    expect(movedChild.parentId).toBe('proj-b');
    const newParent = result.find(t => t.id === 'proj-b');
    expect(newParent.childIds).toContain('child-1');
    const oldParent = result.find(t => t.id === 'proj-a');
    expect(oldParent.childIds).not.toContain('child-1');
  });

  it('prevents dropping a project inside one of its own descendants', () => {
    const result = moveTaskInTree(baseTasks, 'proj-a', 'child-1', 'inside');
    expect(result).toBe(baseTasks);
  });
});
