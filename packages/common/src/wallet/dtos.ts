import type { WalletType } from '../shared/enums';

export interface WalletDto {
  id: string;
  groupId: string;
  name: string;
  type: WalletType;
  currencyCode: string;
  initialBalance: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
