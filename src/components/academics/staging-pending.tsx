'use client';
import { useFormStatus } from 'react-dom';
import { useLinkStatus } from 'next/link';
import './staging-loading.css';

export function StagingPendingButton({ label, pendingLabel, className, disabled = false }: {
  label: string; pendingLabel: string; className?: string; disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={disabled || pending} aria-busy={pending}>
    {pending && <span className="staging-spinner" aria-hidden="true" />}{pending ? pendingLabel : label}
  </button>;
}

/** Must be a descendant of Link; does not prefetch protected data. */
export function StagingLinkProgress() {
  const { pending } = useLinkStatus();
  return <span className="staging-link-progress" role="status">{pending && <><span className="staging-spinner" aria-hidden="true" /><span className="staging-sr-only">Loading page…</span></>}</span>;
}

export function StagingActionProgress() {
  return <div className="staging-action-progress" role="status" aria-live="polite"><span className="staging-spinner" aria-hidden="true" /><div><strong>Updating test report…</strong><p>Please keep this page open while the change is checked and saved.</p></div></div>;
}
