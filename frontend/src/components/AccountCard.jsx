// Sidebar account card — avatar + name trigger opening a small menu
// (Settings, Sign out), replacing the old "Account" nav link. Single
// account only: no switch/add-account theater, every item does something.
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from 'react-aria-components';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Logout glyph (lucide log-out paths) — also reused bare for the
// icon-only sign-out button, where no "Log out" text is wanted.
export function SignOutIcon({ size = 32, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SettingsIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 5h8M12 5h2M2 11h4M8 11h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10.5" cy="5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.5" cy="11" r="1.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronDown({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AccountCard({ user, onSettings, onSignOut, collapsed = false }) {
  const name = user?.fullName || user?.username || 'Account';
  const initial = (name.charAt(0) || 'A').toUpperCase();
  return (
    <MenuTrigger>
      <Button
        aria-label={`Account: ${name}`}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200 ease-out hover:bg-white/10',
          collapsed && 'justify-center px-0',
        )}
      >
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt=""
            className="size-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink">
            {initial}
          </span>
        )}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-heading">
              {name}
            </span>
            <ChevronDown className="size-4 shrink-0 text-body" />
          </>
        )}
      </Button>
      <Popover
        offset={8}
        className="w-52 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl"
      >
        <Menu
          onAction={(key) => {
            if (key === 'settings') onSettings?.();
            if (key === 'logout') onSignOut?.();
          }}
          className="outline-none"
        >
          <MenuItem
            id="settings"
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-heading outline-none transition-colors duration-150 data-[focused]:bg-white/10"
          >
            <SettingsIcon className="size-4 shrink-0 text-body" />
            Settings
          </MenuItem>
          <MenuItem
            id="logout"
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-heading outline-none transition-colors duration-150 data-[focused]:bg-white/10"
          >
            <SignOutIcon size={16} className="shrink-0 text-body" />
            Log out
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
