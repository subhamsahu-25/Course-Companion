import { useState } from 'react';
import { linksForRole, nameForRole } from '../utils/roleLinks.js';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip.jsx';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Sidebar({ role, currentPage, onPageChange, onLogout }) {
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = linksForRole(role);
  const roleName = nameForRole(role);

  return (
    <>
      {/* Desktop sidebar — deep blue, collapsible. The toggle lives on the
          sidebar's outer edge (half-overlapping the border), never inside
          the title row. */}
      <aside
        className={cn(
          'relative hidden min-h-screen shrink-0 border-r border-[#3f6593] bg-[#1b3554] px-5 py-7 transition-all duration-300 md:block',
          open ? 'w-62.5' : 'w-[76px] px-3',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="absolute -right-4 top-9 z-10 flex size-8 items-center justify-center rounded-full border border-[#3f6593] bg-[#1b3554] text-[#c0e6fd] shadow-md transition-all duration-200 ease-out hover:bg-[#3f6593] hover:opacity-90 active:scale-95"
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
        <div className={cn('mb-9 flex items-center', open ? 'px-2' : 'justify-center')}>
          {open ? (
            <div>
              <div className="text-[21px] font-semibold text-[#c0e6fd]">
                Course Companion
              </div>
              <div className="mt-2 inline-block rounded-md border border-[#5b86b6]/60 px-2 py-0.5 text-[13px] font-bold text-[#c0e6fd]">{roleName}</div>
            </div>
          ) : (
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#3f6593] text-lg font-bold text-[#c0e6fd]">
              C
            </div>
          )}
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
                    ? 'bg-[#c0e6fd] font-medium text-[#000f22]'
                    : 'text-[#80aad3] hover:bg-white/10 hover:text-[#c0e6fd]',
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
          <div className="mt-10 border-t border-[#3f6593] pt-3">
            <button
              onClick={onLogout}
              className="w-full rounded-md px-3 py-2.5 text-left text-[15px] text-[#80aad3] transition-all duration-200 ease-out hover:bg-white/10 hover:text-[#c0e6fd] hover:opacity-80 active:scale-[0.99]"
            >
              Log out
            </button>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-10 border-t border-[#3f6593] pt-3">
                <button
                  onClick={onLogout}
                  className="w-full rounded-md px-3 py-2.5 text-center text-[15px] text-[#80aad3] transition-all duration-200 ease-out hover:bg-white/10 hover:text-[#c0e6fd] hover:opacity-80 active:scale-[0.99]"
                >
                  ↩
                </button>
              </div>
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
        className="fixed left-4 top-4 z-40 flex size-10 items-center justify-center rounded-full border border-[#5b86b6]/60 bg-[#3f6593] shadow-sm transition-all duration-200 ease-out hover:opacity-90 md:hidden"
      >
        <span className="relative grid size-4 items-center justify-center text-[#c0e6fd]">
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
          <aside className="absolute left-0 top-0 h-full w-64 bg-[#1b3554] px-5 py-7 shadow-xl">
            <div className="mb-9 px-2">
              <div className="text-[21px] font-semibold text-[#c0e6fd]">
                Course Companion
              </div>
              <div className="mt-2 inline-block rounded-md border border-[#5b86b6]/60 px-2 py-0.5 text-[13px] font-bold text-[#c0e6fd]">{roleName}</div>
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
                      ? 'bg-[#80aad3] font-medium text-[#c0e6fd]'
                      : 'text-[#80aad3] hover:bg-white/10',
                  )}
                >
                  {text}
                </button>
              ))}
            </nav>
            <div className="mt-10 border-t border-[#3f6593] pt-3">
              <button
                onClick={onLogout}
                className="w-full rounded-md px-3 py-2.5 text-left text-[15px] text-[#80aad3] transition-all duration-200 ease-out hover:bg-white/10 hover:text-[#c0e6fd] hover:opacity-80 active:scale-[0.99]"
              >
                Log out
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}


