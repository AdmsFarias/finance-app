import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GroupMember } from '../modules/group/group-member.entity';

import { GroupScopeGuard } from './guards/group-scope.guard';

@Module({
  imports: [TypeOrmModule.forFeature([GroupMember])],
  providers: [GroupScopeGuard],
  exports: [GroupScopeGuard, TypeOrmModule],
})
export class CommonModule {}
