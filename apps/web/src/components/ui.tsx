import { AnimatePresence, motion } from 'framer-motion';
import { X, type LucideIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { mediaUrl } from '../lib/api';
import { initials } from '../lib/format';
import { useUi } from '../store/ui';

export function Cover({
  src,
  color,
  name,
  size,
  rounded = 18,
  className = '',
}: {
  src?: string | null;
  color?: string;
  name: string;
  size?: number;
  rounded?: number;
  className?: string;
}) {
  const accent = color ?? '#8b5cf6';
  return (
    <div
      className={`cover ${className}`}
      style={{
        width: size ? `${size}px` : undefined,
        height: size ? `${size}px` : undefined,
        borderRadius: `${rounded}px`,
        ['--cover-accent' as string]: accent,
      }}
    >
      {src ? (
        <img
          src={mediaUrl(src)}
          alt={name}
          loading="lazy"
          draggable={false}
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      <div className="cover-fallback" aria-hidden="true">
        <span className="cover-initials">{initials(name)}</span>
        <span className="cover-ring cover-ring-1" />
        <span className="cover-ring cover-ring-2" />
      </div>
    </div>
  );
}

export function Avatar({
  name,
  color,
  size = 36,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, ${color ?? '#8b5cf6'}, rgba(255,255,255,0.12))`,
        fontSize: Math.max(11, size * 0.36),
      }}
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="Загрузка" />;
}

export function PageLoader() {
  return (
    <div className="page-loader">
      <span className="brand-mark anim-pulse">M</span>
      <Spinner size={22} />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={26} />
      </div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-head">
              {title ? <h3>{title}</h3> : <span />}
              <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ToastHost() {
  const toasts = useUi((state) => state.toasts);
  const dismiss = useUi((state) => state.dismissToast);
  return (
    <div className="toast-host">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            className={`toast toast-${toast.tone}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            onClick={() => dismiss(toast.id)}
          >
            {toast.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {typeof option.count === 'number' ? <em>{option.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Equalizer({ active }: { active: boolean }) {
  return (
    <span className={`eq ${active ? 'on' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
