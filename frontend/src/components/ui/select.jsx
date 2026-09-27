// Shared dropdown — replaces every native <select> in the app with the
// popover-menu pattern (button trigger + listbox), themed to the app
// tokens so a reskin never touches it. Single-select only: `options` is
// [{ id, label }], `value` is the selected id ('' = none, shows the
// placeholder), `onChange` receives the picked id as a string.
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
} from 'react-aria-components';

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

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  ariaLabel,
  className = '',
}) {
  const selected = options.find((option) => option.id === value);
  return (
    <AriaSelect
      selectedKey={value || null}
      onSelectionChange={(key) => onChange(key === null ? '' : String(key))}
      isDisabled={disabled}
      aria-label={ariaLabel || placeholder}
      className={className}
    >
      {({ isOpen }) => (
        <>
          <Button
            className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-bg px-3 py-2.5 text-left text-[15px] outline-none transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
              isOpen ? 'border-accent' : 'border-border'
            } ${selected ? 'text-heading' : 'text-body'}`}
          >
            <span className="min-w-0 flex-1 truncate">
              {selected ? selected.label : placeholder}
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-body transition-transform duration-200 ease-out ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </Button>
          <Popover
            offset={6}
            className="w-[var(--trigger-width)] overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl"
            style={{ maxHeight: '16rem' }}
          >
            <ListBox className="outline-none">
              {options.map((option) => (
                <ListBoxItem
                  key={option.id}
                  id={option.id}
                  textValue={option.label}
                  className="cursor-pointer truncate rounded-lg px-3 py-2 text-sm text-heading outline-none transition-colors duration-150 data-[disabled]:opacity-40 data-[focused]:bg-white/10 data-[selected]:bg-accent data-[selected]:text-accent-ink data-[selected]:data-[focused]:bg-accent-hover"
                >
                  {option.label}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </>
      )}
    </AriaSelect>
  );
}
