import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import {
  CreateFixedExpenseInput,
  ErrorCode,
  FixedExpenseCheckDto,
  FixedExpenseChecklistItemDto,
  FixedExpenseDto,
  ToggleFixedExpenseCheckInput,
  UpdateFixedExpenseInput,
} from '@finance/common';

import { CurrencyService } from '../currency/currency.service';

import { FixedExpenseCheck } from './fixed-expense-check.entity';
import { FixedExpense } from './fixed-expense.entity';

function mapExpense(e: FixedExpense): FixedExpenseDto {
  return {
    id: e.id,
    groupId: e.groupId,
    name: e.name,
    amount: e.amount,
    currencyCode: e.currencyCode,
    dayOfMonth: e.dayOfMonth,
    recurrence: e.recurrence,
    note: e.note,
    archivedAt: e.archivedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function mapCheck(c: FixedExpenseCheck): FixedExpenseCheckDto {
  return {
    id: c.id,
    fixedExpenseId: c.fixedExpenseId,
    yearMonth: c.yearMonth,
    paidAt: c.paidAt.toISOString(),
    paidAmount: c.paidAmount,
    note: c.note,
    createdBy: c.createdBy,
    createdAt: c.createdAt.toISOString(),
  };
}

export type ToggleResult =
  | { state: 'checked'; check: FixedExpenseCheckDto }
  | { state: 'unchecked' };

@Injectable()
export class FixedExpenseService {
  constructor(
    @InjectRepository(FixedExpense)
    private readonly expenses: Repository<FixedExpense>,
    @InjectRepository(FixedExpenseCheck)
    private readonly checks: Repository<FixedExpenseCheck>,
    private readonly currencyService: CurrencyService,
  ) {}

  async list(groupId: string, includeArchived = false): Promise<FixedExpenseDto[]> {
    const rows = await this.expenses.find({
      where: includeArchived ? { groupId } : { groupId, archivedAt: IsNull() },
      order: { dayOfMonth: 'ASC', name: 'ASC' },
    });
    return rows.map(mapExpense);
  }

  async getById(groupId: string, expenseId: string): Promise<FixedExpenseDto> {
    const expense = await this.findOwned(groupId, expenseId);
    return mapExpense(expense);
  }

  async create(groupId: string, input: CreateFixedExpenseInput): Promise<FixedExpenseDto> {
    await this.assertCurrency(input.currencyCode);
    await this.assertNameUnique(groupId, input.name);

    const entity = this.expenses.create({
      groupId,
      name: input.name.trim(),
      amount: input.amount,
      currencyCode: input.currencyCode,
      dayOfMonth: input.dayOfMonth,
      recurrence: input.recurrence,
      note: input.note ?? null,
    });
    const saved = await this.expenses.save(entity);
    return mapExpense(saved);
  }

  async update(
    groupId: string,
    expenseId: string,
    input: UpdateFixedExpenseInput,
  ): Promise<FixedExpenseDto> {
    const expense = await this.findOwned(groupId, expenseId);
    if (expense.archivedAt) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'Cannot update an archived fixed expense',
        fieldErrors: { _: 'validation.fixedExpense.archived' },
      });
    }

    if (input.currencyCode !== undefined && input.currencyCode !== expense.currencyCode) {
      await this.assertCurrency(input.currencyCode);
      expense.currencyCode = input.currencyCode;
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.toLowerCase() !== expense.name.toLowerCase()) {
        await this.assertNameUnique(groupId, name, expenseId);
      }
      expense.name = name;
    }
    if (input.amount !== undefined) expense.amount = input.amount;
    if (input.dayOfMonth !== undefined) expense.dayOfMonth = input.dayOfMonth;
    if (input.recurrence !== undefined) expense.recurrence = input.recurrence;
    if (input.note !== undefined) expense.note = input.note ?? null;

    const saved = await this.expenses.save(expense);
    return mapExpense(saved);
  }

  async archive(groupId: string, expenseId: string): Promise<void> {
    const expense = await this.findOwned(groupId, expenseId);
    if (expense.archivedAt) return;
    expense.archivedAt = new Date();
    await this.expenses.save(expense);
  }

  async restore(groupId: string, expenseId: string): Promise<FixedExpenseDto> {
    const expense = await this.findOwned(groupId, expenseId);
    if (!expense.archivedAt) return mapExpense(expense);

    await this.assertNameUnique(groupId, expense.name, expenseId);
    expense.archivedAt = null;
    const saved = await this.expenses.save(expense);
    return mapExpense(saved);
  }

  async toggleCheck(
    groupId: string,
    expenseId: string,
    userId: string,
    input: ToggleFixedExpenseCheckInput,
  ): Promise<ToggleResult> {
    const expense = await this.findOwned(groupId, expenseId);
    if (expense.archivedAt) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'Cannot check an archived fixed expense',
        fieldErrors: { _: 'validation.fixedExpense.archived' },
      });
    }

    const existing = await this.checks.findOne({
      where: { fixedExpenseId: expenseId, yearMonth: input.yearMonth },
    });
    if (existing) {
      await this.checks.remove(existing);
      return { state: 'unchecked' };
    }

    const entity = this.checks.create({
      fixedExpenseId: expenseId,
      yearMonth: input.yearMonth,
      paidAt: new Date(),
      paidAmount: input.paidAmount ?? null,
      note: input.note ?? null,
      createdBy: userId,
    });
    const saved = await this.checks.save(entity);
    return { state: 'checked', check: mapCheck(saved) };
  }

  async getChecklist(
    groupId: string,
    yearMonth: string,
  ): Promise<FixedExpenseChecklistItemDto[]> {
    const expenses = await this.expenses.find({
      where: { groupId, archivedAt: IsNull() },
      order: { dayOfMonth: 'ASC', name: 'ASC' },
    });
    if (expenses.length === 0) return [];

    const ids = expenses.map((e) => e.id);
    const checks = await this.checks
      .createQueryBuilder('c')
      .where('c.fixed_expense_id IN (:...ids)', { ids })
      .andWhere('c.year_month = :yearMonth', { yearMonth })
      .getMany();

    const byExpense = new Map<string, FixedExpenseCheck>();
    for (const c of checks) byExpense.set(c.fixedExpenseId, c);

    return expenses.map((e) => ({
      expense: mapExpense(e),
      check: byExpense.has(e.id) ? mapCheck(byExpense.get(e.id)!) : null,
    }));
  }

  private async findOwned(groupId: string, expenseId: string): Promise<FixedExpense> {
    const expense = await this.expenses.findOne({ where: { id: expenseId, groupId } });
    if (!expense) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'Fixed expense not found',
      });
    }
    return expense;
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

  private async assertNameUnique(
    groupId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.expenses
      .createQueryBuilder('e')
      .where('e.group_id = :groupId', { groupId })
      .andWhere('LOWER(e.name) = LOWER(:name)', { name })
      .andWhere('e.archived_at IS NULL');
    if (excludeId) qb.andWhere('e.id <> :excludeId', { excludeId });
    const dup = await qb.getOne();
    if (dup) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'Fixed expense with this name already exists in the group',
        fieldErrors: { name: 'validation.fixedExpense.duplicateName' },
      });
    }
  }
}
