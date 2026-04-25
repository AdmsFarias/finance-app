import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import {
  CreateWalletInput,
  ErrorCode,
  UpdateWalletInput,
  WalletDto,
} from '@finance/common';

import { CurrencyService } from '../currency/currency.service';

import { Wallet } from './wallet.entity';

function mapWallet(w: Wallet): WalletDto {
  return {
    id: w.id,
    groupId: w.groupId,
    name: w.name,
    type: w.type,
    currencyCode: w.currencyCode,
    initialBalance: w.initialBalance,
    archivedAt: w.archivedAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    private readonly currencyService: CurrencyService,
  ) {}

  async list(groupId: string, includeArchived = false): Promise<WalletDto[]> {
    const rows = await this.wallets.find({
      where: includeArchived ? { groupId } : { groupId, archivedAt: IsNull() },
      order: { name: 'ASC' },
    });
    return rows.map(mapWallet);
  }

  async getById(groupId: string, walletId: string): Promise<WalletDto> {
    const wallet = await this.findOwned(groupId, walletId);
    return mapWallet(wallet);
  }

  async create(groupId: string, input: CreateWalletInput): Promise<WalletDto> {
    await this.assertCurrency(input.currencyCode);

    const existing = await this.wallets
      .createQueryBuilder('w')
      .where('w.group_id = :groupId', { groupId })
      .andWhere('LOWER(w.name) = LOWER(:name)', { name: input.name })
      .andWhere('w.archived_at IS NULL')
      .getOne();
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'Wallet with this name already exists in the group',
        fieldErrors: { name: 'validation.wallet.duplicateName' },
      });
    }

    const entity = this.wallets.create({
      groupId,
      name: input.name.trim(),
      type: input.type,
      currencyCode: input.currencyCode,
      initialBalance: input.initialBalance,
    });
    const saved = await this.wallets.save(entity);
    return mapWallet(saved);
  }

  async update(
    groupId: string,
    walletId: string,
    input: UpdateWalletInput,
  ): Promise<WalletDto> {
    const wallet = await this.findOwned(groupId, walletId);
    if (wallet.archivedAt) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'Cannot update an archived wallet',
      });
    }

    if (input.currencyCode !== undefined && input.currencyCode !== wallet.currencyCode) {
      await this.assertCurrency(input.currencyCode);
      wallet.currencyCode = input.currencyCode;
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      const dup = await this.wallets
        .createQueryBuilder('w')
        .where('w.group_id = :groupId', { groupId })
        .andWhere('w.id <> :walletId', { walletId })
        .andWhere('LOWER(w.name) = LOWER(:name)', { name })
        .andWhere('w.archived_at IS NULL')
        .getOne();
      if (dup) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: 'Wallet with this name already exists in the group',
          fieldErrors: { name: 'validation.wallet.duplicateName' },
        });
      }
      wallet.name = name;
    }
    if (input.type !== undefined) wallet.type = input.type;
    if (input.initialBalance !== undefined) wallet.initialBalance = input.initialBalance;

    const saved = await this.wallets.save(wallet);
    return mapWallet(saved);
  }

  async archive(groupId: string, walletId: string): Promise<void> {
    const wallet = await this.findOwned(groupId, walletId);
    if (wallet.archivedAt) return;
    wallet.archivedAt = new Date();
    await this.wallets.save(wallet);
  }

  async restore(groupId: string, walletId: string): Promise<WalletDto> {
    const wallet = await this.findOwned(groupId, walletId);
    if (!wallet.archivedAt) return mapWallet(wallet);

    const dup = await this.wallets
      .createQueryBuilder('w')
      .where('w.group_id = :groupId', { groupId })
      .andWhere('w.id <> :walletId', { walletId })
      .andWhere('LOWER(w.name) = LOWER(:name)', { name: wallet.name })
      .andWhere('w.archived_at IS NULL')
      .getOne();
    if (dup) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'Another active wallet already uses this name',
        fieldErrors: { name: 'validation.wallet.duplicateName' },
      });
    }

    wallet.archivedAt = null;
    const saved = await this.wallets.save(wallet);
    return mapWallet(saved);
  }

  private async findOwned(groupId: string, walletId: string): Promise<Wallet> {
    const wallet = await this.wallets.findOne({ where: { id: walletId, groupId } });
    if (!wallet) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Wallet not found' });
    }
    return wallet;
  }

  private async assertCurrency(code: string): Promise<void> {
    const currency = await this.currencyService.getByCode(code);
    if (!currency || !currency.isActive) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Currency ${code} is not supported`,
        fieldErrors: { currencyCode: 'validation.currency.unsupported' },
      });
    }
  }
}
