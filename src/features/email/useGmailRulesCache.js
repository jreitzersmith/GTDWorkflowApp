import { useState, useEffect } from "react";

const LS_LABELS_KEY     = 'gtd_gmail_labels';
const LS_FILTERS_KEY    = 'gtd_gmail_filters';
const LS_FETCHED_AT_KEY = 'gtd_gmail_rules_fetched_at';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Caches Gmail labels and filters in localStorage so the Rules tab loads
// instantly on page reload instead of re-fetching from the Gmail API every time.
// The fetchedAt timestamp lets callers decide whether to re-validate the cache.
function useGmailRulesCache() {
  const [gmailLabels, setGmailLabelsState] = useState(() => readJson(LS_LABELS_KEY)  || []);
  const [gmailFilters, setGmailFiltersState] = useState(() => readJson(LS_FILTERS_KEY) || []);
  const [fetchedAt, setFetchedAt] = useState(() => localStorage.getItem(LS_FETCHED_AT_KEY) || null);

  useEffect(() => {
    localStorage.setItem(LS_LABELS_KEY, JSON.stringify(gmailLabels));
  }, [gmailLabels]);

  useEffect(() => {
    localStorage.setItem(LS_FILTERS_KEY, JSON.stringify(gmailFilters));
  }, [gmailFilters]);

  const setGmailLabels = (labelsOrUpdater) => {
    setGmailLabelsState(labelsOrUpdater);
  };

  const setGmailFilters = (filtersOrUpdater) => {
    setGmailFiltersState(filtersOrUpdater);
    // Record when the cache was last populated from a fresh API fetch
    const now = new Date().toISOString();
    setFetchedAt(now);
    localStorage.setItem(LS_FETCHED_AT_KEY, now);
  };

  return { gmailLabels, setGmailLabels, gmailFilters, setGmailFilters, fetchedAt };
}

export { useGmailRulesCache, LS_LABELS_KEY, LS_FILTERS_KEY, LS_FETCHED_AT_KEY, readJson };
