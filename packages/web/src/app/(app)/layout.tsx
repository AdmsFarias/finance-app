import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';

import { AppHeader } from '@/components/app-header';
import { ApiClientError } from '@/lib/api/errors';
import { apiServerFetch } from '@/lib/api/server';
import { resolveActiveGroup } from '@/lib/groups/active-group';
import { ACTIVE_GROUP_COOKIE } from '@/lib/server/cookies';

import type { MeResponseDto } from '@finance/common';

/**
 * Logged-in app layout. Loads /auth/me once here and passes it down via props;
 * child pages that only need user/groups don't refetch.
 * The middleware already guarantees a session cookie exists when we get here.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  let me: MeResponseDto;
  try {
    me = await apiServerFetch<MeResponseDto>('/auth/me');
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  const store = await cookies();
  const cookieGroup = store.get(ACTIVE_GROUP_COOKIE)?.value ?? null;
  const active = resolveActiveGroup(cookieGroup, me.groups);

  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader user={me.user} groups={me.groups} activeGroupId={active?.id ?? null} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
