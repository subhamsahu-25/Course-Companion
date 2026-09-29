import { useState } from 'react';
import {
  CheckDone01,
  ClockFastForward,
  Grid03,
  HomeLine,
  Inbox01,
  UploadCloud01,
  UsersPlus,
  UserSquare,
} from '@untitledui/icons';
import { linksForRole } from '../utils/roleLinks.js';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.jsx';
import AccountCard from './AccountCard.jsx';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Custom Courses glyph (user-supplied artwork): stacked books.
// currentColor-driven so active/inactive states recolor it for free.
function CoursesIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      aria-hidden="true"
      className={className}
    >
      <rect width="256" height="256" fill="none" />
      <rect x="48" y="40" width="64" height="176" rx="8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      <path d="M217.67,205.77l-46.81,10a8,8,0,0,1-9.5-6.21L128.18,51.8a8.07,8.07,0,0,1,6.15-9.57l46.81-10a8,8,0,0,1,9.5,6.21L223.82,196.2A8.07,8.07,0,0,1,217.67,205.77Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      <line x1="48" y1="72" x2="112" y2="72" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      <line x1="48" y1="184" x2="112" y2="184" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      <line x1="133.16" y1="75.48" x2="195.61" y2="62.06" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      <line x1="139.79" y1="107.04" x2="202.25" y2="93.62" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
      <line x1="156.39" y1="185.94" x2="218.84" y2="172.52" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
    </svg>
  );
}

// Custom Manage-students glyph (user-supplied artwork): graduation cap.
function StudentsIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      aria-hidden="true"
      className={className}
    >
      <rect width="256" height="256" fill="none" />
      <path d="M226.53,56.41l-96-32a8,8,0,0,0-5.06,0l-96,32A8,8,0,0,0,24,64v80a8,8,0,0,0,16,0V75.1L73.59,86.29a64,64,0,0,0,20.65,88.05c-18,7.06-33.56,19.83-44.94,37.29a8,8,0,1,0,13.4,8.74C77.77,197.25,101.57,184,128,184s50.23,13.25,65.3,36.37a8,8,0,0,0,13.4-8.74c-11.38-17.46-27-30.23-44.94-37.29a64,64,0,0,0,20.65-88l44.12-14.7a8,8,0,0,0,0-15.18ZM176,120A48,48,0,1,1,89.35,91.55l36.12,12a8,8,0,0,0,5.06,0l36.12-12A47.89,47.89,0,0,1,176,120Z" fill="currentColor" />
    </svg>
  );
}

// Icon per nav page — single-tier slim rail (our nav is flat per role,
// so no dual-tier tree; the rail mirrors linksForRole exactly).
const PAGE_ICONS = {
  'student-dashboard': HomeLine,
  'student-join': UsersPlus,
  'student-courses': CoursesIcon,
  'student-history': ClockFastForward,
  'ta-review': Inbox01,
  'ta-join': UsersPlus,
  'admin-courses': CoursesIcon,
  'admin-upload': UploadCloud01,
  'admin-students': StudentsIcon,
  'admin-tas': UserSquare,
  account: CheckDone01,
};

function NavButton({ page, text, active, onNavigate }) {
  const Icon = PAGE_ICONS[page] || Grid03;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onNavigate(page)}
          aria-label={text}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex size-11 items-center justify-center rounded-xl transition-all duration-200 ease-out active:scale-95',
            active
              ? 'bg-accent text-accent-ink shadow-sm'
              : 'text-body hover:bg-white/10 hover:text-heading',
          )}
        >
          <Icon className="size-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function Sidebar({ role, user, currentPage, onPageChange, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = linksForRole(role);
  const goSettings = () => onPageChange('account');

  return (
    <>
      {/* Desktop slim rail — fixed icon column. The bottom stack mirrors
          the old wide sidebar: account card, logout inside its menu. */}
      <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col items-center border-r border-border bg-surface px-3 py-5 md:flex">
        <nav className="flex flex-1 flex-col items-center gap-1.5">
          {links.map(([page, text]) => (
            <NavButton
              key={page}
              page={page}
              text={text}
              active={currentPage === page}
              onNavigate={onPageChange}
            />
          ))}
        </nav>

        <div className="w-full border-t border-border pt-3">
          <AccountCard
            user={user}
            onSettings={goSettings}
            onSignOut={onLogout}
            collapsed
          />
        </div>
      </aside>

      {/* Mobile floating toggle — opens sidebar as overlay drawer */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        className="fixed left-4 top-4 z-40 flex size-10 items-center justify-center rounded-full border border-border bg-accent shadow-sm transition-all duration-200 ease-out hover:opacity-90 md:hidden"
      >
        <span className="relative grid size-4 items-center justify-center text-heading">
          <span
            className={cn(
              'absolute h-0.5 w-full rounded-full bg-current transition-all duration-300',
              mobileOpen ? 'translate-y-0 rotate-45' : '-translate-y-[5px]',
            )}
          />
          <span
            className={cn(
              'absolute h-0.5 w-full rounded-full bg-current transition-all',
              mobileOpen ? 'opacity-0' : 'opacity-100',
            )}
          />
          <span
            className={cn(
              'absolute h-0.5 w-full rounded-full bg-current transition-all duration-300',
              mobileOpen ? 'translate-y-0 -rotate-45' : 'translate-y-[5px]',
            )}
          />
        </span>
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-surface px-5 py-7 shadow-xl">
            <div className="mb-9 px-2">
              <div className="text-[21px] font-semibold text-heading">
                Course Companion
              </div>
            </div>
            <nav className="space-y-1">
              {links.map(([page, text]) => (
                <button
                  key={page}
                  onClick={() => {
                    onPageChange(page);
                    setMobileOpen(false);
                  }}
                  className={cn(
                    'w-full rounded-md px-3 py-2.5 text-left text-[15px] transition',
                    currentPage === page
                      ? 'bg-body font-medium text-heading'
                      : 'text-body hover:bg-white/10',
                  )}
                >
                  {text}
                </button>
              ))}
            </nav>
            <div className="mt-10 border-t border-border pt-3">
              <AccountCard
                user={user}
                onSettings={() => {
                  goSettings();
                  setMobileOpen(false);
                }}
                onSignOut={onLogout}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
