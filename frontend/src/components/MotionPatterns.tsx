import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion } from "motion/react";
import type { NotificationItem } from "../types";
import { Icon } from "./Icons";

/* ============================================================
   1. Floating Tooltip (vue-radix-tooltip via @base-ui/react/tooltip)
   ============================================================ */

export function MotionTooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Provider delay={160} closeDelay={60}>
      {children}
    </Tooltip.Provider>
  );
}

export function MotionTooltip({
  content,
  side = "top",
  children,
}: {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={7} className="mp-tooltip-positioner">
          <Tooltip.Popup className="mp-tooltip-popup">{content}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* ============================================================
   2. Skeleton Shimmer (react-skeleton-shimmer)
   ============================================================ */

export function SkeletonShimmer({
  width = "100%",
  height = 18,
  radius = 10,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="mp-skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    >
      <motion.span
        className="mp-skeleton__wave"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ repeat: Infinity, duration: 1.3, ease: "linear" }}
      />
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="app" aria-busy="true" aria-label="Loading workspace">
      <div className="sf-global">
        <SkeletonShimmer width={44} height={44} radius={10} />
        <div style={{ flex: 1, maxWidth: 460, margin: "0 auto" }}>
          <SkeletonShimmer width="100%" height={42} radius={999} />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <SkeletonShimmer width={36} height={36} radius={999} />
          <SkeletonShimmer width={42} height={42} radius={999} />
        </div>
      </div>
      <div className="scroll">
        <div className="page">
          <div className="hero-card">
            <SkeletonShimmer width={240} height={28} style={{ margin: "0 auto 14px" }} />
            <SkeletonShimmer width="100%" height={116} radius={16} />
          </div>
          <div className="stat-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="card card--pad" key={i}>
                <SkeletonShimmer width="52%" height={14} style={{ marginBottom: 14 }} />
                <SkeletonShimmer width="74%" height={32} style={{ marginBottom: 10 }} />
                <SkeletonShimmer width="45%" height={13} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, marginTop: 18 }}>
            <div className="card card--pad">
              <SkeletonShimmer width={180} height={18} style={{ marginBottom: 16 }} />
              <SkeletonShimmer width="100%" height={210} radius={14} />
            </div>
            <div className="card card--pad">
              <SkeletonShimmer width={160} height={18} style={{ marginBottom: 16 }} />
              <SkeletonShimmer width="100%" height={210} radius={14} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="card card--pad" key={i}>
            <SkeletonShimmer width="48%" height={13} style={{ marginBottom: 12 }} />
            <SkeletonShimmer width="70%" height={30} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
        <div className="card card--pad">
          <SkeletonShimmer width={150} height={18} style={{ marginBottom: 16 }} />
          <SkeletonShimmer width="100%" height={240} radius={14} />
        </div>
        <div className="card card--pad">
          <SkeletonShimmer width={170} height={18} style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonShimmer key={i} width="100%" height={28} radius={10} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function TransactionRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`sk-${i}`}>
          <td>
            <SkeletonShimmer width={82} height={15} radius={6} />
          </td>
          <td>
            <SkeletonShimmer width={120} height={15} radius={6} />
          </td>
          <td>
            <SkeletonShimmer width={96} height={22} radius={999} />
          </td>
          <td>
            <SkeletonShimmer width="78%" height={15} radius={6} />
          </td>
          <td className="right">
            <SkeletonShimmer width={76} height={16} radius={6} style={{ marginLeft: "auto" }} />
          </td>
          <td />
        </tr>
      ))}
    </>
  );
}

/* ============================================================
   3. Morphing Edit Button -> Inline Panel (react-create-button)
   ============================================================ */

export function MorphEditButton({
  morphId,
  title,
  tooltip = "Quick edit",
  buttonLabel,
  width = 480,
  children,
}: {
  morphId: string;
  title: string;
  tooltip?: string;
  buttonLabel?: string;
  width?: number;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const layoutId = `morph-edit-${morphId}`;
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const triggerBtn = (
    <motion.button
      type="button"
      layoutId={layoutId}
      className={buttonLabel ? "btn btn--ghost btn--sm" : "mini-btn"}
      style={{ borderRadius: buttonLabel ? 10 : 8 }}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(true);
      }}
      aria-label={tooltip}
    >
      <Icon name="edit" />
      {buttonLabel && <span>{buttonLabel}</span>}
    </motion.button>
  );

  return (
    <>
      <MotionTooltip content={tooltip}>{triggerBtn}</MotionTooltip>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                className="mp-morph-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  close();
                }}
              >
                <motion.div
                  layoutId={layoutId}
                  className="mp-morph-panel"
                  style={{ maxWidth: width, borderRadius: 22 }}
                  transition={{ type: "spring", stiffness: 430, damping: 34 }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-label={title}
                >
                  <div className="mp-morph-panel__head">
                    <h3 style={{ fontSize: 16.5 }}>{title}</h3>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={close}
                      aria-label="Close editor"
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, delay: 0.04 }}
                  >
                    {children(close)}
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

/* ============================================================
   4. App Store Shared-Layout Card Expand Sheet (js-app-store)
   ============================================================ */

export function ExpandableCardSheet({
  open,
  cardLayoutId,
  title,
  subtitle,
  headlineValue,
  onClose,
  children,
}: {
  open: boolean;
  cardLayoutId: string;
  title: string;
  subtitle?: string;
  headlineValue?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="mp-appstore-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={onClose}
        >
          <motion.div
            layoutId={cardLayoutId}
            className="mp-appstore-sheet"
            transition={{ type: "spring", stiffness: 390, damping: 34 }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={title}
          >
            <div className="mp-appstore-sheet__head">
              <div>
                {subtitle && (
                  <div
                    className="muted"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 3,
                    }}
                  >
                    {subtitle}
                  </div>
                )}
                <motion.h3
                  layoutId={`${cardLayoutId}-title`}
                  style={{ fontSize: 20, fontWeight: 700 }}
                >
                  {title}
                </motion.h3>
                {headlineValue && (
                  <motion.div
                    layoutId={`${cardLayoutId}-val`}
                    className="num"
                    style={{ fontSize: 32, fontWeight: 700, marginTop: 6, color: "var(--ink)" }}
                  >
                    {headlineValue}
                  </motion.div>
                )}
              </div>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>
            <motion.div
              className="mp-appstore-sheet__body"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, delay: 0.05 }}
            >
              {children}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ============================================================
   5. Dynamic & Stacked Notifications List (vue-notifications-list)
   ============================================================ */

export function AnimatedNotificationsList({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [stacked, setStacked] = useState(false);

  const visible = notifications.filter((n) => !dismissedIds.includes(n.id));

  const tone: Record<NotificationItem["kind"], [string, string]> = {
    warn: ["", "alert"],
    pos: ["bare-icon--blue", "checkCircle"],
    info: ["bare-icon--blue", "bell"],
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="between" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>
          {visible.length} active {visible.length === 1 ? "notification" : "notifications"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {visible.length > 1 && (
            <button
              type="button"
              className="btn btn--subtle btn--sm"
              onClick={() => setStacked((s) => !s)}
            >
              <Icon name="layers" /> {stacked ? "Expand list" : "Stack cards"}
            </button>
          )}
          {dismissedIds.length > 0 ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setDismissedIds([])}
            >
              <Icon name="refresh" /> Restore ({dismissedIds.length})
            </button>
          ) : (
            visible.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setDismissedIds(notifications.map((n) => n.id))}
              >
                Clear all
              </button>
            )
          )}
        </div>
      </div>

      {stacked && visible.length > 1 ? (
        <div
          className="mp-notif-stack-wrap"
          style={{ height: 96 + Math.min(3, visible.length - 1) * 14 }}
          onClick={() => setStacked(false)}
          title="Click to expand notifications"
        >
          {visible.slice(0, 4).map((n, idx) => {
            const [colorCls, ic] = tone[n.kind];
            return (
              <motion.div
                key={n.id}
                layoutId={`notif-item-${n.id}`}
                className="mp-notif-card"
                initial={false}
                animate={{
                  y: idx * 12,
                  scale: 1 - idx * 0.035,
                  opacity: 1 - idx * 0.16,
                }}
                transition={{ type: "spring", stiffness: 410, damping: 32 }}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  zIndex: 20 - idx,
                  transformOrigin: "top center",
                }}
              >
                <span className={`bare-icon ${colorCls}`} style={{ fontSize: 20 }}>
                  <Icon name={ic} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="between">
                    <span className="cell-strong" style={{ fontSize: 14 }}>
                      {n.title}
                    </span>
                    <span className="muted num" style={{ fontSize: 12 }}>
                      {n.time}
                    </span>
                  </div>
                  <div
                    className="muted"
                    style={{
                      fontSize: 13,
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {n.body}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((n) => {
              const [colorCls, ic] = tone[n.kind];
              return (
                <motion.div
                  key={n.id}
                  layout
                  layoutId={`notif-item-${n.id}`}
                  className="mp-notif-card"
                  initial={{ opacity: 0, y: -12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92, x: 24 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                >
                  <span className={`bare-icon ${colorCls}`} style={{ fontSize: 20, marginTop: 2 }}>
                    <Icon name={ic} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="between">
                      <span className="cell-strong" style={{ fontSize: 14 }}>
                        {n.title}
                      </span>
                      <span className="muted num" style={{ fontSize: 12 }}>
                        {n.time}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                      {n.body}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setDismissedIds((prev) => [...prev, n.id])}
                    aria-label={`Dismiss ${n.title}`}
                  >
                    <Icon name="close" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {visible.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="muted"
              style={{ fontSize: 13, padding: "12px 0" }}
            >
              All caught up — no active alerts.
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   6. 2D Layout Card Reordering Hook & Handle (js-reorder-items)
   ============================================================ */

export function usePersistedCardOrder<T extends { id: string }>(
  storageKey: string,
  items: T[]
) {
  const [orderIds, setOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const orderedItems = React.useMemo(() => {
    if (!orderIds.length) return items;
    const pos = new Map(orderIds.map((id, idx) => [id, idx]));
    return [...items].sort((a, b) => {
      const ia = pos.has(a.id) ? pos.get(a.id)! : 9999;
      const ib = pos.has(b.id) ? pos.get(b.id)! : 9999;
      return ia - ib;
    });
  }, [items, orderIds]);

  const swapIds = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      const current = orderedItems.map((item) => item.id);
      const fromIdx = current.indexOf(sourceId);
      const toIdx = current.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return;
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      setOrderIds(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
    },
    [orderedItems, storageKey]
  );

  const shuffleOrder = useCallback(() => {
    const current = orderedItems.map((item) => item.id);
    if (current.length < 2) return;
    const next = [...current];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    if (next.every((id, i) => id === current[i])) {
      next.push(next.shift()!);
    }
    setOrderIds(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, [orderedItems, storageKey]);

  const resetOrder = useCallback(() => {
    setOrderIds([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return {
    orderedItems,
    draggingId,
    setDraggingId,
    swapIds,
    shuffleOrder,
    resetOrder,
    hasCustomOrder: orderIds.length > 0,
  };
}

export function CardDragHandle({
  id,
  onStartDrag,
  onEndDrag,
}: {
  id: string;
  onStartDrag: (id: string) => void;
  onEndDrag: () => void;
}) {
  return (
    <MotionTooltip content="Drag to reorder card">
      <span
        className="mp-drag-handle"
        draggable
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
          onStartDrag(id);
        }}
        onDragEnd={onEndDrag}
        role="button"
        tabIndex={0}
        aria-label="Drag to reorder card"
      >
        <Icon name="grip" />
      </span>
    </MotionTooltip>
  );
}
