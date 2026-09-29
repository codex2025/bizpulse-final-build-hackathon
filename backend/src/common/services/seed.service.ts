import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Client } from '../../clients/entities/client.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Expense } from '../../expenses/entities/expense.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Expense) private readonly expenseRepo: Repository<Expense>,
  ) {}

  async onModuleInit() {
    this.logger.log('Checking for demo data seeding...');
    await this.seed();
    this.logger.log('Seed process completed successfully.');
  }

  private async seed() {
    const hashedPassword = await bcrypt.hash('demo123', 10);
    
    // 1. Ensure Users exist with meaningful realistic baselines
    let demoUser = await this.userRepo.findOne({ where: { email: 'demo@bizpulse.com' } });
    if (!demoUser) {
      demoUser = await this.userRepo.save({
        email: 'demo@bizpulse.com',
        password: hashedPassword,
        full_name: 'Alex Demo',
        business_name: 'Bizpulse Studio & Labs',
        job_title: 'Senior Engineering Consultant',
        gst_number: '27AAACG1234F1Z5',
        persona_type: 'business',
        monthly_income: 150000,
        monthly_expense: 45000,
      });
    } else {
      // Update with realistic baselines
      await this.userRepo.update(demoUser.id, {
        monthly_income: 150000,
        monthly_expense: 45000,
      });
    }

    let adminUser = await this.userRepo.findOne({ where: { email: 'admin@bizpulse.com' } });
    if (!adminUser) {
      adminUser = await this.userRepo.save({
        email: 'admin@bizpulse.com',
        password: hashedPassword,
        full_name: 'Sarah Admin',
        business_name: 'Bizpulse HQ',
        job_title: 'Operations Director',
        gst_number: '27BBBCG5678H2Z6',
        persona_type: 'business',
        monthly_income: 250000,
        monthly_expense: 75000,
      });
    }

    // 2. Ensure Clients exist for demoUser
    const existingClients = await this.clientRepo.find({ where: { user_id: demoUser.id } });
    const targetClients = 6;
    if (existingClients.length < targetClients) {
      const clientSeeds = [
        { name: 'Apex Design Systems', email: 'billing@apexdesign.com', phone: '+91 98765 43210', address: '402 Cyber City, Bengaluru' },
        { name: 'Zenith Tech Solutions', email: 'accounts@zenithtech.io', phone: '+91 98765 43211', address: '12 Tech Park, Hyderabad' },
        { name: 'Klaro Financial Labs', email: 'finance@klarolabs.com', phone: '+91 98765 43212', address: '88 BKC Tower, Mumbai' },
        { name: 'Nova Cloud Studio', email: 'invoices@novacloud.co', phone: '+91 98765 43213', address: '101 MG Road, Pune' },
        { name: 'Prism AI Media', email: 'pay@prismai.com', phone: '+91 98765 43214', address: '77 Indiranagar, Bengaluru' },
        { name: 'Vortex Global Logistics', email: 'vendor@vortexglobal.com', phone: '+91 98765 43215', address: '500 OMR Corridor, Chennai' },
      ];

      const newClients: any[] = [];
      for (let i = existingClients.length; i < targetClients; i++) {
        const seed = clientSeeds[i % clientSeeds.length];
        newClients.push({
          name: seed.name,
          email: seed.email,
          phone: seed.phone,
          address: seed.address,
          gst_number: `27GST000${i}Z9`,
          user_id: demoUser.id,
        });
      }
      await this.clientRepo.save(newClients);
    }
    const finalClients = await this.clientRepo.find({ where: { user_id: demoUser.id } });

    // 3. Ensure Invoices exist with realistic values and status distribution
    const existingInvoices = await this.invoiceRepo.find({ where: { user_id: demoUser.id } });
    if (existingInvoices.length === 0) {
      const invoiceData: any[] = [];
      const now = new Date();

      // Recent 4 months of realistic invoicing
      const monthlyTemplates = [
        { clientIdx: 0, subtotal: 65000, desc: 'Enterprise UI Architecture & Consulting', status: 'paid', monthOffset: 0 },
        { clientIdx: 1, subtotal: 45000, desc: 'Full-Stack Performance Optimization', status: 'paid', monthOffset: 0 },
        { clientIdx: 2, subtotal: 35000, desc: 'API Integration & Security Audit', status: 'pending', monthOffset: 0 },
        { clientIdx: 3, subtotal: 75000, desc: 'Q3 Product Strategy Retainer', status: 'paid', monthOffset: 1 },
        { clientIdx: 4, subtotal: 40000, desc: 'Machine Learning Workflow Deployment', status: 'paid', monthOffset: 1 },
        { clientIdx: 0, subtotal: 60000, desc: 'Monthly UI Maintenance & Sprint Payout', status: 'paid', monthOffset: 2 },
        { clientIdx: 5, subtotal: 30000, desc: 'Infrastructure Migration Support', status: 'paid', monthOffset: 2 },
        { clientIdx: 2, subtotal: 20000, desc: 'Ad-hoc Cloud Security Advisory', status: 'overdue', monthOffset: 1 },
      ];

      for (let i = 0; i < monthlyTemplates.length; i++) {
        const item = monthlyTemplates[i];
        const date = new Date(now.getFullYear(), now.getMonth() - item.monthOffset, 5 + (i * 2));
        const dueDate = new Date(date.getTime() + 15 * 24 * 60 * 60 * 1000);
        const client = finalClients[item.clientIdx % finalClients.length];
        const gst = item.subtotal * 0.18;

        invoiceData.push({
          user_id: demoUser.id,
          client_id: client.id,
          invoice_number: `INV-2026-${1000 + i}`,
          issue_date: date.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          subtotal: item.subtotal,
          gst_rate: 18,
          gst_amount: gst,
          total_amount: item.subtotal + gst,
          status: item.status,
          notes: 'Standard Net-15 commercial billing',
          items: [
            { description: item.desc, quantity: 1, unit_price: item.subtotal, total: item.subtotal }
          ]
        });
      }
      await this.invoiceRepo.save(this.invoiceRepo.create(invoiceData));
    }

    // 4. Ensure realistic monthly expenses
    const existingExpenses = await this.expenseRepo.find({ where: { user_id: demoUser.id } });
    if (existingExpenses.length === 0) {
      const now = new Date();
      const currentMonthStr = now.toISOString().slice(0, 7);

      const expenseTemplates = [
        { category: 'office', amount: 18000, desc: 'Apartment Workspace / Rent', dateOffset: 2 },
        { category: 'software', amount: 6500, desc: 'Cloud Hosting & SaaS Tools (AWS/Figma)', dateOffset: 5 },
        { category: 'travel', amount: 4500, desc: 'Commute & Travel Transit', dateOffset: 8 },
        { category: 'marketing', amount: 8000, desc: 'Portfolio Promotion & Ads', dateOffset: 12 },
        { category: 'utilities', amount: 5000, desc: 'High-speed Fiber Internet & Electricity', dateOffset: 15 },
        { category: 'office', amount: 3000, desc: 'Office Ergonomics & Supplies', dateOffset: 20 },
      ];

      const expenseData: any[] = [];
      // Current month + last month
      for (const offset of [0, 1]) {
        for (const exp of expenseTemplates) {
          const date = new Date(now.getFullYear(), now.getMonth() - offset, exp.dateOffset);
          expenseData.push({
            user_id: demoUser.id,
            category: exp.category,
            amount: exp.amount,
            description: exp.desc,
            expense_date: date.toISOString().split('T')[0],
          });
        }
      }
      await this.expenseRepo.save(this.expenseRepo.create(expenseData));
    }
  }
}
