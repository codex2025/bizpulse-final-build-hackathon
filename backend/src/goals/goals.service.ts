import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from './entities/goal.entity';

@Injectable()
export class GoalsService {
  constructor(@InjectRepository(Goal) private goalRepo: Repository<Goal>) {}

  async create(userId: string, dto: Partial<Goal>) {
    const goal = this.goalRepo.create({ ...dto, user_id: userId });
    return this.goalRepo.save(goal);
  }

  findAll(userId: string) {
    return this.goalRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    const goal = await this.goalRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  async update(id: string, userId: string, dto: Partial<Goal>) {
    await this.goalRepo.update({ id, user_id: userId }, dto);
    return this.findOne(id, userId);
  }

  async contribute(id: string, userId: string, amount: number) {
    const goal = await this.findOne(id, userId);
    const newAmount = Math.min(
      goal.target_amount,
      goal.current_amount + amount,
    );
    const status = newAmount >= goal.target_amount ? 'completed' : 'active';
    await this.goalRepo.update(
      { id, user_id: userId },
      { current_amount: newAmount, status },
    );
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.goalRepo.delete({ id, user_id: userId });
    return { deleted: true };
  }

  async getSummary(userId: string) {
    const goals = await this.findAll(userId);
    const active = goals.filter((g) => g.status === 'active');
    const completed = goals.filter((g) => g.status === 'completed');
    const totalTargeted = active.reduce((s, g) => s + g.target_amount, 0);
    const totalSaved = active.reduce((s, g) => s + g.current_amount, 0);
    return {
      total: goals.length,
      active: active.length,
      completed: completed.length,
      totalTargeted,
      totalSaved,
      overallProgress:
        totalTargeted > 0 ? Math.round((totalSaved / totalTargeted) * 100) : 0,
      goals,
    };
  }
}
