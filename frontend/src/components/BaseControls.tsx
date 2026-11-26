import React, { useMemo, useRef, useState } from "react";
import { Input } from "@base-ui/react/input";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import { Select } from "@base-ui/react/select";
import { Tabs } from "@base-ui/react/tabs";
import { Toast } from "@base-ui/react/toast";
import { motion } from "motion/react";
import type { Preferences } from "../types";
import { Icon } from "./Icons";

/* ============================================================
   1. Base UI Toast System (@base-ui/react/toast)
   ============================================================ */

export const appToastManager = Toast.createToastManager();

export function showAppToast(
  title: string,
  options?: { description?: string; type?: "success" | "alert" }
) {
  appToastManager.add({
    title,
    description: options?.description,
    type: options?.type || "success",
  });
}

function ToastViewportList() {
  const { toasts } = Toast.useToastManager();
  return (
    <>
      {toasts.map((t) => {
        const isAlert = t.type === "alert";
        return (
          <Toast.Root key={t.id} toast={t} className="bui-toast">
            <Toast.Content className="bui-toast__content">
              <span className={"bui-toast__icon " + (isAlert ? "bui-toast__icon--alert" : "")}>
                <Icon name={isAlert ? "alert" : "checkCircle"} />
              </span>
              <div className="bui-toast__body">
                <Toast.Title className="bui-toast__title" />
                {t.description && <Toast.Description className="bui-toast__desc" />}
              </div>
              <Toast.Close className="bui-toast__close" aria-label="Dismiss notification">
                <Icon name="close" />
              </Toast.Close>
            </Toast.Content>
          </Toast.Root>
        );
      })}
    </>
  );
}

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={appToastManager} timeout={3200} limit={4}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="bui-toast-viewport">
          <ToastViewportList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

/* ============================================================
   2. Base UI Select (@base-ui/react/select)
   ============================================================ */

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export function BaseSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  width,
  ariaLabel,
  id,
}: {
  value: string;
  onValueChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  width?: number | string;
  ariaLabel?: string;
  id?: string;
}) {
  const itemsMap = useMemo(
    () => Object.fromEntries(options.map((o) => [o.value, o.label])),
    [options]
  );
  const currentLabel = itemsMap[value] ?? placeholder;

  return (
    <Select.Root
      value={value}
      items={itemsMap}
      onValueChange={(next) => {
        if (next !== null && next !== undefined) {
          onValueChange(String(next));
        }
      }}
    >
      <Select.Trigger
        id={id}
        aria-label={ariaLabel}
        className="bui-select-trigger"
        style={width ? { width } : undefined}
      >
        <Select.Value className="bui-select-value">{currentLabel}</Select.Value>
        <Select.Icon className="bui-select-icon">
          <Icon name="chevronDown" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="bui-positioner">
          <Select.Popup className="bui-select-popup">
            <Select.List className="bui-select-list">
              {options.map((opt) => (
                <Select.Item key={opt.value} value={opt.value} className="bui-select-item">
                  <Select.ItemText className="bui-select-item__text">
                    <span>{opt.label}</span>
                    {opt.sublabel && <span className="bui-select-item__sub">{opt.sublabel}</span>}
                  </Select.ItemText>
                  <Select.ItemIndicator className="bui-select-item__check">
                    <Icon name="check" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

/* ============================================================
   3. Base UI Language Dropdown (@base-ui/react/menu)
   ============================================================ */

const LANGUAGE_OPTIONS: { code: Preferences["language"]; short: string; label: string }[] = [
  { code: "en", short: "EN", label: "English" },
  { code: "pl", short: "PL", label: "Polski" },
  { code: "fr", short: "FR", label: "Français" },
];

export function LanguageDropdown({
  language,
  onSelectLanguage,
}: {
  language: Preferences["language"];
  onSelectLanguage: (lang: Preferences["language"]) => void;
}) {
  const active = LANGUAGE_OPTIONS.find((l) => l.code === language) || LANGUAGE_OPTIONS[0];

  return (
    <Menu.Root>
      <Menu.Trigger className="bui-lang-trigger" aria-label="Select display language">
        <Icon name="language" />
        <span className="bui-lang-trigger__code">{active.short}</span>
        <Icon name="chevronDown" style={{ fontSize: 14 }} />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" className="bui-positioner">
          <Menu.Popup className="bui-menu-popup">
            <div className="bui-menu-heading">Display Language</div>
            <Menu.RadioGroup
              value={language}
              onValueChange={(val) => onSelectLanguage(val as Preferences["language"])}
            >
              {LANGUAGE_OPTIONS.map((item) => (
                <Menu.RadioItem key={item.code} value={item.code} className="bui-menu-item">
                  <span className="bui-menu-item__code num">{item.short}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <Menu.RadioItemIndicator className="bui-menu-item__check">
                    <Icon name="check" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/* ============================================================
   4. Base UI Popover Calendar DatePicker (@base-ui/react/popover)
   ============================================================ */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parseIso(iso: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return { y: 2026, m: 4, d: 28 };
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatReadableDate(iso: string): string {
  const { y, m, d } = parseIso(iso);
  const shortMonth = (MONTH_NAMES[m] || "May").slice(0, 3);
  return `${String(d).padStart(2, "0")} ${shortMonth} ${y}`;
}

export function BaseDatePicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (iso: string) => void;
  ariaLabel?: string;
}) {
  const parsed = parseIso(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed.y);
  const [viewMonth, setViewMonth] = useState(parsed.m);

  const daysGrid = useMemo(() => {
    const firstDayJs = new Date(viewYear, viewMonth, 1).getDay();
    const startOffset = (firstDayJs + 6) % 7; // Monday = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: ({ day: number; iso: string } | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, iso: toIso(viewYear, viewMonth, d) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const stepMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          const p = parseIso(value);
          setViewYear(p.y);
          setViewMonth(p.m);
        }
        setOpen(nextOpen);
      }}
    >
      <Popover.Trigger className="bui-date-trigger" aria-label={ariaLabel || "Select date"}>
        <span className="num" style={{ fontWeight: 600, fontSize: 15 }}>
          {formatReadableDate(value)}
        </span>
        <Icon name="calendar" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="bui-positioner">
          <Popover.Popup className="bui-calendar-popup">
            <div className="bui-calendar__head">
              <button
                type="button"
                className="mini-btn"
                onClick={() => stepMonth(-1)}
                aria-label="Previous month"
              >
                <Icon name="chevronLeft" />
              </button>
              <div className="bui-calendar__title">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                className="mini-btn"
                onClick={() => stepMonth(1)}
                aria-label="Next month"
              >
                <Icon name="chevronRight" />
              </button>
            </div>

            <div className="bui-calendar__weekdays">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="bui-calendar__grid">
              {daysGrid.map((cell, idx) => {
                if (!cell) return <span key={`e-${idx}`} />;
                const selected = cell.iso === value;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    className={"bui-calendar__day num" + (selected ? " active" : "")}
                    onClick={() => {
                      onChange(cell.iso);
                      setOpen(false);
                    }}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="bui-calendar__foot">
              <button
                type="button"
                className="btn btn--subtle btn--sm"
                onClick={() => {
                  const now = new Date();
                  const iso = toIso(now.getFullYear(), now.getMonth(), now.getDate());
                  onChange(iso);
                  setOpen(false);
                }}
              >
                Today
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ============================================================
   5. Base UI Refined Inputs & CSV File Dropzone (@base-ui/react/input)
   ============================================================ */

export function BaseInput(
  props: Omit<React.ComponentProps<typeof Input>, "style" | "className"> & {
    style?: React.CSSProperties;
    className?: string;
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
  }
) {
  const { startAdornment, endAdornment, className, style, ...rest } = props;
  if (!startAdornment && !endAdornment) {
    return (
      <Input
        className={["bui-input", className].filter(Boolean).join(" ")}
        style={style}
        {...rest}
      />
    );
  }
  return (
    <div className="bui-input-group" style={style}>
      {startAdornment && <span className="bui-input-adorn">{startAdornment}</span>}
      <Input
        className={["bui-input bui-input--bare", className].filter(Boolean).join(" ")}
        {...rest}
      />
      {endAdornment && <span className="bui-input-adorn">{endAdornment}</span>}
    </div>
  );
}

export function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="bui-input-group">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className="bui-input bui-input--bare"
      />
      <button
        type="button"
        className="bui-eye-btn"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        <Icon name={visible ? "eyeOff" : "eye"} />
      </button>
    </div>
  );
}

const CURRENCY_SYM: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

export function CurrencyInput({
  value,
  onValueChange,
  currency = "USD",
  placeholder = "0.00",
  allowNegative = false,
  id,
}: {
  value: string;
  onValueChange: (val: string) => void;
  currency?: string;
  placeholder?: string;
  allowNegative?: boolean;
  id?: string;
}) {
  const sym = CURRENCY_SYM[currency] || "$";
  const regex = allowNegative ? /[^0-9.-]/g : /[^0-9.]/g;
  return (
    <div className="bui-input-group">
      <span className="bui-input-prefix num">{sym}</span>
      <Input
        id={id}
        className="bui-input bui-input--bare num"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(regex, ""))}
      />
    </div>
  );
}

export function BaseFileDropzone({
  file,
  onFileChange,
}: {
  file: File | null;
  onFileChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={"bui-dropzone" + (dragOver ? " dragover" : "")}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files?.[0] || null;
        if (dropped) onFileChange(dropped);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
      />
      <Icon name="csv" style={{ fontSize: 19, color: "var(--blue-600)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {file ? (
          <div className="cell-strong" style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file.name}{" "}
            <span className="muted num" style={{ fontWeight: 500 }}>
              ({Math.max(1, Math.round(file.size / 1024))} KB)
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
            Drop CSV statement or <span style={{ color: "var(--blue-600)" }}>browse</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   6. Base UI + Motion Segmented Tabs (@base-ui/react/tabs + motion)
   ============================================================ */

export function SegmentedTabs<T extends string>({
  value,
  onValueChange,
  items,
  layoutId,
  style,
}: {
  value: T;
  onValueChange: (val: T) => void;
  items: { value: T; label: string; icon?: string }[];
  layoutId: string;
  style?: React.CSSProperties;
}) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={(val) => onValueChange(val as T)}
      style={style}
    >
      <Tabs.List className="bui-seg">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <Tabs.Tab
              key={item.value}
              value={item.value}
              className={"bui-seg__tab" + (active ? " active" : "")}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  className="bui-seg__pill"
                  transition={{ type: "spring", stiffness: 460, damping: 36 }}
                />
              )}
              <span className="bui-seg__label">
                {item.icon && <Icon name={item.icon} />}
                {item.label}
              </span>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
    </Tabs.Root>
  );
}
