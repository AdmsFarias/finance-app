import type { SupportedLocale } from '../shared/enums';

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  locale: SupportedLocale;
  timezone: string;
  baseCurrency: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface GroupSummaryDto {
  id: string;
  name: string;
  baseCurrency: string;
  role: string;
}

export interface AuthResponseDto {
  accessToken: string;
  expiresIn: number;
  user: AuthUserDto;
  groups: GroupSummaryDto[];
}

export interface MeResponseDto {
  user: AuthUserDto;
  groups: GroupSummaryDto[];
}
