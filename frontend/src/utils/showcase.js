// Showcase data helpers (kept out of Showcase.jsx so fast-refresh lint
// stays happy — that file may only export components).
import { linksForRole, nameForRole } from './roleLinks.js';

export { nameForRole };

// What each section is for — the per-card explanation under its button.
export const SECTION_BLURBS = {
  'student-dashboard': 'Your home base — stats and recent activity at a glance.',
  'student-join': 'Join a course with the code your instructor shared.',
  'student-courses': 'Browse courses, open modules and read material.',
  'student-ask': 'Ask anything — a TA reviews the draft before you see it.',
  'student-history': 'Every answer you received, with sources and ratings.',
  'ta-review': 'Approve, edit, rate, and flag answer drafts.',
  'ta-join': 'Join a course as a TA with its join code.',
  'admin-courses': 'Create courses and hand out join codes.',
  'admin-upload': 'Upload PDFs — they become answerable material.',
  'admin-students': 'Students per course, with questions asked.',
  'admin-tas': 'TAs per course, with reviews resolved.',
};

// Self-contained card art (no external images): initial on surface.
export function cardArt(label) {
  const initial = (label.charAt(0) || '?').toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">` +
    `<rect width="300" height="400" rx="24" fill="#151A24"/>` +
    `<circle cx="150" cy="170" r="72" fill="none" stroke="#7C7CF4" stroke-width="6"/>` +
    `<text x="150" y="196" font-family="sans-serif" font-size="84" font-weight="bold" fill="#EDEFF5" text-anchor="middle">${initial}</text>` +
    `<rect x="70" y="280" width="160" height="10" rx="5" fill="#2A3242"/>` +
    `<rect x="95" y="302" width="110" height="10" rx="5" fill="#2A3242"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function sectionsForRole(role) {
  return linksForRole(role).map(([page, text]) => ({
    page,
    title: text,
    blurb: SECTION_BLURBS[page] || 'Part of your workspace.',
  }));
}
