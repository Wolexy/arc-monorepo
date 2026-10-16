import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  /* ---- grant free access ---- */
  async grantAccess(userId: number, adminId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.stage2AccessGranted = true;
    user.accessGranted = true;
    user.accessGrantedAt = new Date();
    user.accessGrantedBy = adminId;

    await this.userRepo.save(user);

    return { success: true };
  }

  // /* ---- revoke access ---- */
  async revokeAccess(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.stage2AccessGranted = false;
    user.accessGranted = false;
    user.accessGrantedAt = null;
    user.accessGrantedBy = null;

    await this.userRepo.save(user);

    return { success: true };
  }

  /* ---- list users ---- */
  async listUsers() {
    return this.userRepo.find({
      select: {
        id: true,
        email: true,
        role: true,
        accessGranted: true,
        accountEnabled: true,
        stage2AccessGranted: true,
        accessGrantedAt: true,
        accessGrantedBy: true,
        createdAt: true,
        emailVerified: true,
        lastLoginAt: true,
      },
    });
  }

  //8 Account enable/disable
  async updateAccountStatus(
    userId: number,
    accountEnabled: boolean,
    adminId: number,
  ) {
    // An administrator must not be able to lock themselves out.
    if (userId === adminId && !accountEnabled) {
      throw new BadRequestException(
        'You cannot disable your own administrator account.',
      );
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Administrators cannot disable any administrator account.
    // Enabling is still allowed so a disabled admin can be restored.
    if (!accountEnabled && user.role === 'ADMIN') {
      throw new ForbiddenException('Administrator accounts cannot be disabled.');
    }

    user.accountEnabled = accountEnabled;

    await this.userRepo.save(user);

    return {
      success: true,
      accountEnabled: user.accountEnabled,
    };
  }
}
