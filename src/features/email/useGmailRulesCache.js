import { useState, useEffect, useRef } from "react";
import { supabase } from '../../api/supabase.js';

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

// Caches Gmail labels and filters in localStorage for instant page-load reads,
// and persists them to user_settings.gmail_rules in Supabase so the cache
// survives device changes. On auth, Supabase wins over localStorage.
function useGmailRulesCache({ authUser } = {}) {
  const [gmailLabels, setGmailLabelsState] = useState(() => readJson(LS_LABELS_KEY)  || []);
  const [gmailFilters, setGmailFiltersState] = useState(() => readJson(LS_FILTERS_KEY) || []);
  const [fetchedAt, setFetchedAt] = useState(() => localStorage.getItem(LS_FETCHED_AT_KEY) || null);

  // Gates the Supabase write — only write after the initial server read completes,
  // so we don't overwrite Supabase with stale localStorage before reading.
  const serverDataLoaded = useRef(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(LS_LABELS_KEY, JSON.stringify(gmailLabels));
  }, [gmailLabels]);

  useEffect(() => {
    localStorage.setItem(LS_FILTERS_KEY, JSON.stringify(gmailFilters));
  }, [gmailFilters]);

  // On auth: read from Supabase once; server wins over localStorage
  useEffect(() => {
    if (!authUser) return;
    supabase
      .from('user_settings')
      .select('gmail_rules')
      .eq('user_id', authUser.id)
      .single()
      .then(({ data }) => {
        const rules = data?.gmail_rules;
        if (rules) {
          if (Array.isArray(rules.labels))  setGmailLabelsState(rules.labels);
          if (Array.isArray(rules.filters)) setGmailFiltersState(rules.filters);
          if (rules.fetchedAt) {
            setFetchedAt(rules.fetchedAt);
            localStorage.setItem(LS_FETCHED_AT_KEY, rules.fetchedAt);
          }
        }
        serverDataLoaded.current = true;
      });
  }, [authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced write to Supabase on any cache change (only after initial read)
  useEffect(() => {
    if (!authUser || !serverDataLoaded.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      supabase
        .from('user_settings')
        .upsert(
          { user_id: authUser.id, gmail_rules: { labels: gmailLabels, filters: gmailFilters, fetchedAt } },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.error('Gmail rules sync error:', error);
        });
    }, 1500);
    return () => clearTimeout(debounceRef.current);
  }, [gmailLabels, gmailFilters, fetchedAt, authUser]); // eslint-disable-line react-hooks/exhaustive-deps

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
