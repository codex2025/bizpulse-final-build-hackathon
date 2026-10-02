import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(@InjectRepository(Client) private repo: Repository<Client>) {}

  create(userId: string, dto: any) {
    const client = this.repo.create({ ...dto, user_id: userId });
    return this.repo.save(client);
  }

  findAll(userId: string) {
    return this.repo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  findOne(id: string, userId: string) {
    return this.repo.findOne({ where: { id, user_id: userId } });
  }

  async update(id: string, userId: string, dto: any) {
    await this.repo.update({ id, user_id: userId }, dto);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.repo.delete({ id, user_id: userId });
    return { deleted: true };
  }
}
