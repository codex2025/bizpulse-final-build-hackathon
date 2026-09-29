import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';

@Injectable()
export class ExpensesService {
  constructor(@InjectRepository(Expense) private repo: Repository<Expense>) {}

  create(userId: string, dto: any) {
    const expense = this.repo.create({ ...dto, user_id: userId });
    return this.repo.save(expense);
  }

  findAll(userId: string) {
    return this.repo.find({ where: { user_id: userId }, order: { expense_date: 'DESC' } });
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

  /**
   * Bulk import transactions from CSV/PDF statement parsing.
   * Each item: { category, description, amount, expense_date, type: 'income'|'expense' }
   * Only 'expense' type records are imported into expenses table.
   */
  async bulkCreate(userId: string, transactions: any[]) {
    const expenseItems = transactions.filter((t) => t.type === 'expense' || !t.type);
    const created = expenseItems.map((t) =>
      this.repo.create({
        user_id: userId,
        category: t.category || 'Other',
        description: t.description || t.narration || '',
        amount: Math.abs(Number(t.amount)),
        expense_date: t.expense_date || t.date || new Date().toISOString().split('T')[0],
      }),
    );
    const saved = await this.repo.save(created);
    return { imported: saved.length, items: saved };
  }
}
