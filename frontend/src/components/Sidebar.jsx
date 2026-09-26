import { useState } from 'react';
import { linksForRole, nameForRole } from '../utils/roleLinks.js';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.jsx';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Controlled hamburger -> X button (your Skiper99 middle icon, CSS only - no framer-motion needed)
export function MenuIcon({ open, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Close sidebar' : 'Open sidebar'}
      className={cn(
        'group flex size-9 cursor-pointer items-center justify-center rounded-md text-[#2B124C] hover:bg-[#F6E7DE]',
        className,
      )}
    >
      <span className="relative grid size-4 items-center justify-center text-current">
        <span
          className={cn(
            'absolute h-0.5 w-full rounded-full bg-current transition-all duration-300',
            open ? 'translate-y-0 rotate-45' : '-translate-y-[5px] rotate-0',
          )}
        />
        <span
          className={cn(
            'absolute h-0.5 w-full rounded-full bg-current transition-all duration-200',
            open ? 'opacity-0' : 'opacity-100',
          )}
        />
        <span
          className={cn(
            'absolute h-0.5 w-full rounded-full bg-current transition-all duration-300',
            open ? 'translate-y-0 -rotate-45' : 'translate-y-[5px] rotate-0',
          )}
        />
      </span>
    </button>
  );
}

export default function Sidebar({ role, currentPage, onPageChange, onLogout }) {
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = linksForRole(role);
  const roleName = nameForRole(role);

  return (
    <>
      {/* Desktop sidebar — deep plum, collapsible */}
      <aside
        className={cn(
          'hidden min-h-screen shrink-0 border-r border-[#522B5B] bg-[#2B124C] px-5 py-7 transition-all duration-300 md:block',
          open ? 'w-62.5' : 'w-[76px] px-3',
        )}
      >
        <div className={cn('mb-9 flex items-center', open ? 'justify-between px-2' : 'justify-center')}>
          {open && (
            <div>
              <div className="text-[21px] font-semibold text-[#FBE4D8]">
                Course Companion
              </div>
              <div className="mt-1 text-[15px] text-[#DFB6B2]">{roleName}</div>
            </div>
          )}
          <MenuIcon
            open={open}
            onClick={() => setOpen((v) => !v)}
            className="text-[#FBE4D8] hover:bg-white/10"
          />
        </div>

        <nav className="space-y-1">
          {links.map(([page, text]) => {
            const btn = (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  'w-full rounded-md px-3 py-2.5 text-[15px] transition',
                  open ? 'text-left' : 'text-center',
                  currentPage === page
                    ? 'bg-[#DFB6B2] font-medium text-[#190019]'
                    : 'text-[#DFB6B2] hover:bg-white/10 hover:text-[#FBE4D8]',
                )}
              >
                {open ? text : text.charAt(0)}
              </button>
            );
            if (open) return btn;
            return (
              <Tooltip key={page}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent>
                  <p>{text}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {open ? (
          <button
            onClick={onLogout}
            className="mt-10 w-full border-t border-[#522B5B] px-2 pt-5 text-left text-[15px] text-[#DFB6B2] hover:text-[#FBE4D8]"
          >
            Log out
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onLogout}
                className="mt-10 w-full border-t border-[#522B5B] pt-5 text-center text-[15px] text-[#DFB6B2] hover:text-[#FBE4D8]"
              >
                ↩
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Log out</p>
            </TooltipContent>
          </Tooltip>
        )}
      </aside>

      {/* Mobile floating toggle — opens sidebar as overlay drawer */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        className="fixed left-4 top-4 z-40 flex size-10 items-center justify-center rounded-full border border-[#DFB6B2] bg-white shadow-sm md:hidden"
      >
        <span className="relative grid size-4 items-center justify-center text-[#2B124C]">
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
          <aside className="absolute left-0 top-0 h-full w-64 bg-white px-5 py-7 shadow-xl">
            <div className="mb-9 px-2">
              <div className="text-[21px] font-semibold text-[#2B124C]">
                Course Companion
              </div>
              <div className="mt-1 text-[15px] text-[#854F6C]">{roleName}</div>
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
                      ? 'bg-[#DFB6B2] font-medium text-[#2B124C]'
                      : 'text-[#854F6C] hover:bg-[#F6E7DE]',
                  )}
                >
                  {text}
                </button>
              ))}
            </nav>
            <button
              onClick={onLogout}
              className="mt-10 w-full border-t border-[#DFB6B2] px-2 pt-5 text-left text-[15px] text-[#854F6C] hover:text-[#2B124C]"
            >
              Log out
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
