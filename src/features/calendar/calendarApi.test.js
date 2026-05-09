import { describe, it, expect } from 'vitest';
import { getLinkedTasks } from './calendarApi.js';

// getLinkedTasks is a pure filter — no API or React dependencies to mock.

describe('getLinkedTasks', () => {
  const taskA = { id: 't1', text: 'Task A', bucket: 'next', done: false, calendarEventId: 'ev-123' };
  const taskB = { id: 't2', text: 'Task B', bucket: 'next', done: false, calendarEventId: 'ev-master' };
  const taskC = { id: 't3', text: 'Task C', bucket: 'next', done: false, calendarEventId: 'ev-other' };
  const taskD = { id: 't4', text: 'Task D', bucket: 'next', done: false, calendarEventId: null };

  it('returns tasks matching the event id', () => {
    const ev = { id: 'ev-123' };
    expect(getLinkedTasks([taskA, taskB, taskC, taskD], ev)).toEqual([taskA]);
  });

  it('returns tasks matching the recurring master event id', () => {
    const ev = { id: 'ev-instance-1', recurringEventId: 'ev-master' };
    expect(getLinkedTasks([taskA, taskB, taskC, taskD], ev)).toEqual([taskB]);
  });

  it('returns multiple tasks when more than one link the same event', () => {
    const taskE = { id: 't5', text: 'Task E', bucket: 'project', done: false, calendarEventId: 'ev-123' };
    const ev = { id: 'ev-123' };
    expect(getLinkedTasks([taskA, taskE, taskC], ev)).toEqual([taskA, taskE]);
  });

  it('returns empty array when no tasks match', () => {
    const ev = { id: 'ev-unrelated' };
    expect(getLinkedTasks([taskA, taskB, taskC, taskD], ev)).toEqual([]);
  });

  it('returns empty array when ev is null', () => {
    expect(getLinkedTasks([taskA], null)).toEqual([]);
  });

  it('returns empty array when ev is undefined', () => {
    expect(getLinkedTasks([taskA], undefined)).toEqual([]);
  });

  it('returns empty array when tasks is null', () => {
    const ev = { id: 'ev-123' };
    expect(getLinkedTasks(null, ev)).toEqual([]);
  });

  it('ignores tasks with null calendarEventId', () => {
    const ev = { id: 'ev-123' };
    expect(getLinkedTasks([taskD], ev)).toEqual([]);
  });
});
