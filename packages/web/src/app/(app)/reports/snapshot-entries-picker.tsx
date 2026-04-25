'use client';

import { useState } from 'react';

interface BatchOption {
  id: string;
  label: string;
}

interface Props {
  groupId: string;
  batches: BatchOption[];
  labels: {
    field: string;
    placeholder: string;
    download: string;
    empty: string;
  };
}

export function SnapshotEntriesPicker({ groupId, batches, labels }: Props) {
  const [batchId, setBatchId] = useState('');

  if (batches.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.empty}</p>;
  }

  const href = batchId
    ? `/api/proxy/groups/${groupId}/reports/snapshots/${batchId}/entries.csv`
    : null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="snapshot-entries-batch" className="text-xs font-medium text-muted-foreground">
          {labels.field}
        </label>
        <select
          id="snapshot-entries-batch"
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
        >
          <option value="">{labels.placeholder}</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      {href ? (
        <a
          href={href}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {labels.download}
        </a>
      ) : (
        <span className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground opacity-40">
          {labels.download}
        </span>
      )}
    </div>
  );
}
