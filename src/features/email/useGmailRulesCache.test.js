import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGmailRulesCache, LS_LABELS_KEY, LS_FILTERS_KEY, LS_FETCHED_AT_KEY, readJson } from './useGmailRulesCache';

// ── readJson ──────────────────────────────────────────────────────────────────

describe('readJson', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when key is absent', () => {
    expect(readJson('missing')).toBeNull();
  });

  it('returns null when stored value is not an array', () => {
    localStorage.setItem('k', JSON.stringify({ foo: 'bar' }));
    expect(readJson('k')).toBeNull();
  });

  it('returns null when stored value is invalid JSON', () => {
    localStorage.setItem('k', 'not-json{{{');
    expect(readJson('k')).toBeNull();
  });

  it('returns the array when stored value is a valid JSON array', () => {
    const arr = [{ id: 'abc', name: 'Work' }];
    localStorage.setItem('k', JSON.stringify(arr));
    expect(readJson('k')).toEqual(arr);
  });
});

// ── useGmailRulesCache ────────────────────────────────────────────────────────

describe('useGmailRulesCache', () => {
  beforeEach(() => localStorage.clear());

  it('initialises labels and filters to empty arrays when localStorage is empty', () => {
    const { result } = renderHook(() => useGmailRulesCache());
    expect(result.current.gmailLabels).toEqual([]);
    expect(result.current.gmailFilters).toEqual([]);
    expect(result.current.fetchedAt).toBeNull();
  });

  it('initialises from cached labels when localStorage has valid data', () => {
    const labels = [{ id: 'l1', name: 'Work' }];
    localStorage.setItem(LS_LABELS_KEY, JSON.stringify(labels));
    const { result } = renderHook(() => useGmailRulesCache());
    expect(result.current.gmailLabels).toEqual(labels);
  });

  it('initialises from cached filters when localStorage has valid data', () => {
    const filters = [{ id: 'f1', criteria: { from: 'news@example.com' } }];
    localStorage.setItem(LS_FILTERS_KEY, JSON.stringify(filters));
    const { result } = renderHook(() => useGmailRulesCache());
    expect(result.current.gmailFilters).toEqual(filters);
  });

  it('falls back to empty array when cached labels JSON is invalid', () => {
    localStorage.setItem(LS_LABELS_KEY, 'bad{{json');
    const { result } = renderHook(() => useGmailRulesCache());
    expect(result.current.gmailLabels).toEqual([]);
  });

  it('falls back to empty array when cached filters JSON is invalid', () => {
    localStorage.setItem(LS_FILTERS_KEY, 'bad{{json');
    const { result } = renderHook(() => useGmailRulesCache());
    expect(result.current.gmailFilters).toEqual([]);
  });

  it('persists labels to localStorage when setGmailLabels is called', async () => {
    const { result } = renderHook(() => useGmailRulesCache());
    const labels = [{ id: 'l2', name: 'Home' }];
    act(() => { result.current.setGmailLabels(labels); });
    expect(JSON.parse(localStorage.getItem(LS_LABELS_KEY))).toEqual(labels);
  });

  it('persists filters to localStorage when setGmailFilters is called', async () => {
    const { result } = renderHook(() => useGmailRulesCache());
    const filters = [{ id: 'f2', criteria: { subject: 'invoice' } }];
    act(() => { result.current.setGmailFilters(filters); });
    expect(JSON.parse(localStorage.getItem(LS_FILTERS_KEY))).toEqual(filters);
  });

  it('records fetchedAt timestamp when setGmailFilters is called', () => {
    const { result } = renderHook(() => useGmailRulesCache());
    expect(result.current.fetchedAt).toBeNull();
    act(() => { result.current.setGmailFilters([]); });
    expect(result.current.fetchedAt).not.toBeNull();
    expect(localStorage.getItem(LS_FETCHED_AT_KEY)).not.toBeNull();
  });

  it('restores fetchedAt from localStorage on mount', () => {
    const ts = '2026-05-08T10:00:00.000Z';
    localStorage.setItem(LS_FETCHED_AT_KEY, ts);
    const { result } = renderHook(() => useGmailRulesCache());
    expect(result.current.fetchedAt).toBe(ts);
  });
});
