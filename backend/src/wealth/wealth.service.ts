import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WealthItem } from './entities/wealth-item.entity';

const ASSET_ICONS: Record<string, string> = {
  cash: '💵', bank: '🏦', stocks: '📈', mutual_funds: '📊',
  gold: '🥇', real_estate: '🏠', fd: '🏛️', pf: '🛡️', other: '💎',
};

const LIABILITY_ICONS: Record<string, string> = {
  home_loan: '🏠', personal_loan: '💳', credit_card: '💳',
  vehicle_loan: '🚗', other: '📋',
};

@Injectable()
export class WealthService {
  constructor(@InjectRepository(WealthItem) private repo: Repository<WealthItem>) {}

  create(userId: string, dto: Partial<WealthItem>) {
    const item = this.repo.create({ ...dto, user_id: userId });
    return this.repo.save(item);
  }

  findAll(userId: string) {
    return this.repo.find({ where: { user_id: userId }, order: { created_at: 'DESC' } });
  }

  async update(id: string, userId: string, dto: Partial<WealthItem>) {
    await this.repo.update({ id, user_id: userId }, dto);
    return this.repo.findOne({ where: { id, user_id: userId } });
  }

  async remove(id: string, userId: string) {
    await this.repo.delete({ id, user_id: userId });
    return { deleted: true };
  }

  async getNetWorthSummary(userId: string) {
    const items = await this.findAll(userId);

    const assets = items.filter((i) => i.type === 'asset');
    const liabilities = items.filter((i) => i.type === 'liability');

    const totalAssets = assets.reduce((s, i) => s + Number(i.value), 0);
    const totalLiabilities = liabilities.reduce((s, i) => s + Number(i.value), 0);
    const netWorth = totalAssets - totalLiabilities;

    // Group assets by category
    const assetBreakdown: Record<string, number> = {};
    for (const a of assets) {
      assetBreakdown[a.category] = (assetBreakdown[a.category] || 0) + Number(a.value);
    }

    const liabilityBreakdown: Record<string, number> = {};
    for (const l of liabilities) {
      liabilityBreakdown[l.category] = (liabilityBreakdown[l.category] || 0) + Number(l.value);
    }

    const assetChartData = Object.entries(assetBreakdown).map(([cat, val]) => ({
      name: cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: val,
      icon: ASSET_ICONS[cat] || '💎',
    }));

    const liabilityChartData = Object.entries(liabilityBreakdown).map(([cat, val]) => ({
      name: cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: val,
      icon: LIABILITY_ICONS[cat] || '📋',
    }));

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      assetChartData,
      liabilityChartData,
      items,
      debtToAssetRatio: totalAssets > 0 ? Math.round((totalLiabilities / totalAssets) * 100) : 0,
    };
  }
}
