// frontend/src/utils/rating.js — shared TA star-rating labels.
// 1 = very poor … 5 = very good. Null/undefined means the TA left the
// rating unattended — never default it to 0, "unrated" must stay
// distinguishable from "rated poorly".
export const RATING_LABELS = {
  1: 'Very poor answer',
  2: 'Poor answer',
  3: 'Decent answer',
  4: 'Good answer',
  5: 'Very good answer',
};

export const formatRating = (rating) =>
  rating === null || rating === undefined ? null : `★ ${rating}/5`;
