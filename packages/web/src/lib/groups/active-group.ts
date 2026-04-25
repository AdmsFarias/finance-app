import type { GroupSummaryDto } from '@finance/common';

/**
 * Resolves which group from the list should be considered "active":
 *  - If the cookie points to a group present in the list, that one wins.
 *  - Otherwise falls back to the first group (ordering comes from the API — by createdAt asc).
 *  - Empty list → null.
 */
export function resolveActiveGroup(
  cookieValue: string | undefined | null,
  groups: GroupSummaryDto[],
): GroupSummaryDto | null {
  if (groups.length === 0) return null;
  if (cookieValue) {
    const match = groups.find((g) => g.id === cookieValue);
    if (match) return match;
  }
  return groups[0] ?? null;
}
