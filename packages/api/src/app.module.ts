import { join } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HealthController } from './health.controller';
import { AuditLog } from './modules/audit/audit-log.entity';
import { AuthPasswordReset } from './modules/auth/auth-password-reset.entity';
import { AuthRefreshToken } from './modules/auth/auth-refresh-token.entity';
import { AuthModule } from './modules/auth/auth.module';
import { Currency } from './modules/currency/currency.entity';
import { CurrencyModule } from './modules/currency/currency.module';
import { FxRate } from './modules/currency/fx-rate.entity';
import { FixedExpenseCheck } from './modules/fixed-expense/fixed-expense-check.entity';
import { FixedExpense } from './modules/fixed-expense/fixed-expense.entity';
import { FixedExpenseModule } from './modules/fixed-expense/fixed-expense.module';
import { FinanceGroup } from './modules/group/finance-group.entity';
import { GroupInvite } from './modules/group/group-invite.entity';
import { GroupMember } from './modules/group/group-member.entity';
import { GroupModule } from './modules/group/group.module';
import { ReportModule } from './modules/report/report.module';
import { BalanceSnapshot } from './modules/snapshot/balance-snapshot.entity';
import { SnapshotBatch } from './modules/snapshot/snapshot-batch.entity';
import { SnapshotModule } from './modules/snapshot/snapshot.module';
import { AppUser } from './modules/user/user.entity';
import { UserModule } from './modules/user/user.module';
import { Wallet } from './modules/wallet/wallet.entity';
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          AppUser,
          AuthRefreshToken,
          AuthPasswordReset,
          FinanceGroup,
          GroupMember,
          GroupInvite,
          Currency,
          FxRate,
          Wallet,
          SnapshotBatch,
          BalanceSnapshot,
          FixedExpense,
          FixedExpenseCheck,
          AuditLog,
        ],
        synchronize: false,
        logging:
          config.get<string>('NODE_ENV') !== 'production' ? ['error', 'warn'] : ['error'],
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        return [
          { name: 'default', ttl: 60_000, limit: isProd ? 300 : 5_000 },
          { name: 'auth', ttl: 60_000, limit: isProd ? 5 : 100 },
        ];
      },
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'pt-BR',
      loaderOptions: {
        path: join(__dirname, 'i18n'),
        watch: false,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        new HeaderResolver(['x-lang']),
        AcceptLanguageResolver,
      ],
    }),
    AuthModule,
    UserModule,
    GroupModule,
    CurrencyModule,
    WalletModule,
    SnapshotModule,
    FixedExpenseModule,
    ReportModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
