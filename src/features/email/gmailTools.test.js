import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithBackoff, batchedAll } from './gmailTools';

// ── fetchWithBackoff ──────────────────────────────────────────────────────────

describe('fetchWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns the response immediately when the first call succeeds', async () => {
    const mockRes = { ok: true, status: 200 };
    fetch.mockResolvedValue(mockRes);

    const res = await fetchWithBackoff('https://example.com', {});
    expect(res).toBe(mockRes);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and returns the successful response', async () => {
    const rateLimited = { ok: false, status: 429, headers: { get: () => null } };
    const success     = { ok: true,  status: 200 };
    fetch.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(success);

    const promise = fetchWithBackoff('https://example.com', {}, 3);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res).toBe(success);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reads Retry-After header when present on 429', async () => {
    const rateLimited = { ok: false, status: 429, headers: { get: (h) => h === 'Retry-After' ? '2' : null } };
    const success     = { ok: true,  status: 200 };
    fetch.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(success);

    const promise = fetchWithBackoff('https://example.com', {}, 3);
    // Should wait 2000 ms (Retry-After: 2)
    await vi.advanceTimersByTimeAsync(2000);
    const res = await promise;

    expect(res).toBe(success);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns the failing response after maxRetries are exhausted', async () => {
    const rateLimited = { ok: false, status: 429, headers: { get: () => null } };
    fetch.mockResolvedValue(rateLimited);

    const promise = fetchWithBackoff('https://example.com', {}, 2);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(429);
    // 1 initial + 2 retries = 3 total calls
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('retries on 503 as well as 429', async () => {
    const serverErr = { ok: false, status: 503, headers: { get: () => null } };
    const success   = { ok: true,  status: 200 };
    fetch.mockResolvedValueOnce(serverErr).mockResolvedValueOnce(success);

    const promise = fetchWithBackoff('https://example.com', {}, 3);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res).toBe(success);
  });

  it('does not retry on non-retryable status codes (e.g. 404)', async () => {
    const notFound = { ok: false, status: 404, headers: { get: () => null } };
    fetch.mockResolvedValue(notFound);

    const res = await fetchWithBackoff('https://example.com', {}, 3);
    expect(res.status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

// ── batchedAll ────────────────────────────────────────────────────────────────

describe('batchedAll', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('processes all items and returns results in the original order', async () => {
    const items = [1, 2, 3, 4, 5];
    const asyncFn = async (n) => n * 2;

    const promise = batchedAll(items, asyncFn, 10, 0);
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('handles an empty items array', async () => {
    const promise = batchedAll([], async (n) => n, 10, 0);
    await vi.runAllTimersAsync();
    expect(await promise).toEqual([]);
  });

  it('fires no more than batchSize requests concurrently per chunk', async () => {
    const concurrentPeak = { value: 0, max: 0 };
    const asyncFn = async (n) => {
      concurrentPeak.value++;
      concurrentPeak.max = Math.max(concurrentPeak.max, concurrentPeak.value);
      await Promise.resolve(); // yield so all in-flight increment before decrement
      concurrentPeak.value--;
      return n;
    };

    const promise = batchedAll([1, 2, 3, 4, 5, 6, 7], asyncFn, 3, 0);
    await vi.runAllTimersAsync();
    await promise;

    expect(concurrentPeak.max).toBeLessThanOrEqual(3);
  });

  it('inserts a delay between chunks', async () => {
    const callTimes = [];
    let elapsed = 0;
    vi.spyOn(global, 'setTimeout').mockImplementation((fn, ms) => {
      elapsed += ms;
      fn();
      return 0;
    });

    const items = [1, 2, 3, 4]; // 2 chunks of 2 with delayMs=200
    const asyncFn = async (n) => n;

    await batchedAll(items, asyncFn, 2, 200);
    // One inter-chunk delay of 200 ms should have been applied
    expect(elapsed).toBeGreaterThanOrEqual(200);
  });
});
