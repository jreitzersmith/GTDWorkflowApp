import { useState } from "react";

// ── useProjectReview ──────────────────────────────────────────────────────────
// Manages all state for the AI-driven project review flow.
function useProjectReview() {
  const [reviewProjectIdx,    setReviewProjectIdx]    = useState(0);
  const [reviewSuggestions,   setReviewSuggestions]   = useState([]);
  const [reviewReady,         setReviewReady]         = useState(false);
  const [reviewMode,          setReviewMode]          = useState(null);
  const [metadataSuggestions, setMetadataSuggestions] = useState([]);

  return { reviewProjectIdx, setReviewProjectIdx, reviewSuggestions, setReviewSuggestions, reviewReady, setReviewReady, reviewMode, setReviewMode, metadataSuggestions, setMetadataSuggestions };
}


export { useProjectReview };
