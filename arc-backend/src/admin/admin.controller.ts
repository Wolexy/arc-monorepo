import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseIntPipe,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AdminService } from './admin.service';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { RoleGuard } from '../common/guards/role.guard';

import { Roles } from '../common/decorators/roles.decorator';
import type { AuthRequest } from 'src/auth/interface/auth-request.interface';

@Controller('admin')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  getUsers() {
    return this.adminService.listUsers();
  }

  @Post('grant/:userId')
  grantAccess(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: AuthRequest,
  ) {
    return this.adminService.grantAccess(userId, req.user.userId);
  }

  @Post('revoke/:userId')
  revokeAccess(@Param('userId', ParseIntPipe) userId: number) {
    return this.adminService.revokeAccess(userId);
  }

  @Patch('users/:userId/status')
  updateAccountStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: UpdateAccountStatusDto,
    @Req() req: AuthRequest,
  ) {
    return this.adminService.updateAccountStatus(
      userId,
      body.accountEnabled,
      req.user.userId,
    );
  }
}
