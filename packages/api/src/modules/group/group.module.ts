import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { AppUser } from '../user/user.entity';

import { FinanceGroup } from './finance-group.entity';
import { GroupController } from './group.controller';
import { GroupInvite } from './group-invite.entity';
import { GroupMember } from './group-member.entity';
import { GroupService } from './group.service';
import { InviteController } from './invite.controller';
import { InviteService } from './invite.service';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinanceGroup, GroupMember, GroupInvite, AppUser]),
    AuthModule,
    CommonModule,
  ],
  controllers: [GroupController, MemberController, InviteController],
  providers: [GroupService, MemberService, InviteService],
  exports: [GroupService],
})
export class GroupModule {}
