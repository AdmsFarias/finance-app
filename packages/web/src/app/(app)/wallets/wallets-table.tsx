'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { type ActionState } from '@/lib/auth/actions';
import { useActionErrorMessage } from '@/lib/forms/use-action-error';
import { useAmountFormatter } from '@/lib/intl/format';
import { archiveWalletAction, restoreWalletAction } from '@/lib/wallets/actions';

import { EditWalletDialog } from './edit-wallet-dialog';

import type { CurrencyDto, WalletDto } from '@finance/common';

interface Props {
  groupId: string;
  wallets: WalletDto[];
  currencies: CurrencyDto[];
  canWrite: boolean;
  canArchive: boolean;
}

export function WalletsTable({
  groupId,
  wallets,
  currencies,
  canWrite,
  canArchive,
}: Props) {
  const t = useTranslations('app.wallets');
  const tTypes = useTranslations('app.wallets.types');
  const toMessage = useActionErrorMessage();
  const formatAmount = useAmountFormatter();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [topError, setTopError] = useState<ActionState | null>(null);

  const topMessage = toMessage(topError);

  function onArchive(wallet: WalletDto) {
    if (!confirm(t('actions.archiveConfirm', { name: wallet.name }))) return;
    setTopError(null);
    setBusyId(wallet.id);
    startTransition(async () => {
      const result = await archiveWalletAction(groupId, wallet.id);
      setBusyId(null);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result);
    });
  }

  function onRestore(wallet: WalletDto) {
    if (!confirm(t('actions.restoreConfirm', { name: wallet.name }))) return;
    setTopError(null);
    setBusyId(wallet.id);
    startTransition(async () => {
      const result = await restoreWalletAction(groupId, wallet.id);
      setBusyId(null);
      if (result.ok) {
        router.refresh();
        return;
      }
      setTopError(result);
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      {topMessage ? (
        <div className="mb-4">
          <Alert variant="error">{topMessage}</Alert>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{t('table.name')}</th>
              <th className="py-2 pr-4 font-medium">{t('table.type')}</th>
              <th className="py-2 pr-4 font-medium">{t('table.currency')}</th>
              <th className="py-2 pr-4 text-right font-medium">{t('table.initialBalance')}</th>
              <th className="py-2 pr-4 font-medium sr-only">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => {
              const rowBusy = busyId === w.id && pending;
              const isArchived = !!w.archivedAt;
              return (
                <tr
                  key={w.id}
                  className="border-b border-border last:border-b-0 data-[archived=true]:opacity-60"
                  data-archived={isArchived}
                >
                  <td className="py-3 pr-4">
                    <span className="font-medium">{w.name}</span>
                    {isArchived ? (
                      <span className="ml-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {t('archivedBadge')}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">{tTypes(w.type)}</td>
                  <td className="py-3 pr-4">{w.currencyCode}</td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums">
                    {formatAmount(w.initialBalance, w.currencyCode)}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <div className="flex justify-end gap-1">
                      {canWrite && !isArchived ? (
                        <EditWalletDialog
                          groupId={groupId}
                          wallet={w}
                          currencies={currencies}
                        />
                      ) : null}
                      {canArchive && !isArchived ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          loading={rowBusy}
                          onClick={() => onArchive(w)}
                        >
                          {t('actions.archive')}
                        </Button>
                      ) : null}
                      {canArchive && isArchived ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          loading={rowBusy}
                          onClick={() => onRestore(w)}
                        >
                          {t('actions.restore')}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
