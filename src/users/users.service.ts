import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /* --------------------------------------------------
       FIND USER BY EMAIL
    ---------------------------------------------------*/

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
    });
  }

  /* --------------------------------------------------
       FIND USER BY ID
    ---------------------------------------------------*/

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
    });
  }

  /* --------------------------------------------------
       CURRENT USER PROFILE
       (Used by /users/me endpoint)
    ---------------------------------------------------*/

  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'role',
        'accessGranted',
        'accessGrantedAt',
        'createdAt',
        'lastLoginAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getMe(userId: number) {
    return this.userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'email',
        'role',
        'accessGranted',
        'accountEnabled',
        'stage2AccessGranted',
        'emailVerified',
      ],
    });
  }

  /* --------------------------------------------------
       GRANT ACCESS TO STAGE 2 (PERSONALITY TEST)
       Used after payment or admin approval
    ---------------------------------------------------*/

  async grantAccess(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.accessGranted = true;
    user.accessGrantedAt = new Date();

    return this.userRepo.save(user);
  }

  /* --------------------------------------------------
       REVOKE ACCESS
    ---------------------------------------------------*/

  async revokeAccess(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.accessGranted = false;

    return this.userRepo.save(user);
  }

  /* --------------------------------------------------
       UPDATE LAST LOGIN
    ---------------------------------------------------*/

  async updateLastLogin(userId: number) {
    await this.userRepo.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  /* --------------------------------------------------
       ADMIN - LIST USERS
    ---------------------------------------------------*/

  async listUsers() {
    return this.userRepo.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
