import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  /** Case-insensitive: `Ada@X.com` and `ada@x.com` are the same person. */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', {
        email: (email || '').trim(),
      })
      .getOne();
  }

  async findByFirebaseUid(uid: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { firebase_uid: uid } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /** Internal update (used by the auth service). Routes exposed to users must pass their input through pickProfileFields first. */
  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    await this.usersRepository.update({ id }, updateData);
    return this.findById(id);
  }
}
