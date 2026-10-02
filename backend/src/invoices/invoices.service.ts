import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity';

@Injectable()
export class InvoicesService {
  constructor(@InjectRepository(Invoice) private repo: Repository<Invoice>) {}

  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `INV-${year}${month}-${rand}`;
  }

  async create(userId: string, dto: any) {
    const subtotal = (dto.items || []).reduce(
      (sum: number, item: any) =>
        sum + Number(item.quantity) * Number(item.unit_price),
      0,
    );
    const gst_rate = dto.gst_rate ?? 18;
    const gst_amount = subtotal * (gst_rate / 100);
    const total_amount = subtotal + gst_amount;

    const items = (dto.items || []).map((item: any) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: Number(item.quantity) * Number(item.unit_price),
    }));

    const invoice = this.repo.create({
      user_id: userId,
      client_id: dto.client_id,
      invoice_number: this.generateInvoiceNumber(),
      issue_date: dto.issue_date,
      due_date: dto.due_date,
      subtotal,
      gst_rate,
      gst_amount,
      total_amount,
      status: dto.status || 'draft',
      notes: dto.notes,
      items,
    });
    return this.repo.save(invoice);
  }

  findAll(userId: string) {
    return this.repo.find({
      where: { user_id: userId },
      relations: ['client', 'items'],
      order: { created_at: 'DESC' },
    });
  }

  findOne(id: string, userId: string) {
    return this.repo.findOne({
      where: { id, user_id: userId },
      relations: ['client', 'items'],
    });
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
