'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { signOutAction } from '@/lib/auth/actions';

import type { AuthUserDto } from '@finance/common';

interface Props {
  user: Pick<AuthUserDto, 'displayName' | 'email'>;
}

export function UserMenu({ user }: Props) {
  const t = useTranslations('app.header.userMenu');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(ev: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(ev.target as Node)) setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials = initialsOf(user.displayName);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 text-sm transition hover:bg-muted"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initials}
        </span>
        <span className="hidden max-w-[140px] truncate sm:inline">{user.displayName}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-60 rounded-md border border-border bg-card p-1 shadow-lg"
        >
          <div className="px-3 py-2">
            <div className="text-sm font-medium">{user.displayName}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </div>
          <div className="my-1 border-t border-border" />
          <MenuLink href="/settings/profile" onClick={() => setOpen(false)}>
            {t('profile')}
          </MenuLink>
          <MenuLink href="/settings/group" onClick={() => setOpen(false)}>
            {t('group')}
          </MenuLink>
          <div className="my-1 border-t border-border" />
          <form action={signOutAction} className="px-1 pb-1">
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
              {tCommon('logout')}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onClick}
      className="block rounded-md px-3 py-2 text-sm transition hover:bg-muted"
    >
      {children}
    </Link>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
