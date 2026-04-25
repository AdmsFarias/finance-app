import { useFormatter } from 'next-intl';
import { getFormatter } from 'next-intl/server';
import { useCallback } from 'react';

const AMOUNT_OPTS = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

const DATE_OPTS = {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
} as const;

type AmountFormatter = (value: string | number, currency: string) => string;
type SignedAmountFormatter = (value: string | number, currency: string) => string;
type DateFormatter = (iso: string) => string;
type NumberFormatter = (value: string | number) => string;

function formatAmount(
  format: ReturnType<typeof useFormatter>,
  value: string | number,
  currency: string,
): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return `${value} ${currency}`;
  return `${format.number(n, AMOUNT_OPTS)} ${currency}`;
}

function formatSignedAmount(
  format: ReturnType<typeof useFormatter>,
  value: string | number,
  currency: string,
): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return `${value} ${currency}`;
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  const abs = format.number(Math.abs(n), AMOUNT_OPTS);
  return `${sign}${abs} ${currency}`;
}

function formatDateIso(format: ReturnType<typeof useFormatter>, iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format.dateTime(d, DATE_OPTS);
}

function formatNumber(
  format: ReturnType<typeof useFormatter>,
  value: string | number,
): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return format.number(n, AMOUNT_OPTS);
}

export function useAmountFormatter(): AmountFormatter {
  const format = useFormatter();
  return useCallback((value, currency) => formatAmount(format, value, currency), [format]);
}

export function useSignedAmountFormatter(): SignedAmountFormatter {
  const format = useFormatter();
  return useCallback((value, currency) => formatSignedAmount(format, value, currency), [format]);
}

export function useDateFormatter(): DateFormatter {
  const format = useFormatter();
  return useCallback((iso) => formatDateIso(format, iso), [format]);
}

export function useNumberFormatter(): NumberFormatter {
  const format = useFormatter();
  return useCallback((value) => formatNumber(format, value), [format]);
}

export async function getAmountFormatter(): Promise<AmountFormatter> {
  const format = await getFormatter();
  return (value, currency) => formatAmount(format, value, currency);
}

export async function getSignedAmountFormatter(): Promise<SignedAmountFormatter> {
  const format = await getFormatter();
  return (value, currency) => formatSignedAmount(format, value, currency);
}

export async function getNumberFormatter(): Promise<NumberFormatter> {
  const format = await getFormatter();
  return (value) => formatNumber(format, value);
}
