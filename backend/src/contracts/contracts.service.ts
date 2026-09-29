import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractAnalysis } from './entities/contract-analysis.entity';
import { ContractClause } from './entities/contract-clause.entity';
import { ContractQuery } from './entities/contract-query.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(ContractAnalysis) private repo: Repository<ContractAnalysis>,
    @InjectRepository(ContractClause) private clauseRepo: Repository<ContractClause>,
    @InjectRepository(ContractQuery) private queryRepo: Repository<ContractQuery>,
    private analyticsService: AnalyticsService,
    private config: ConfigService,
  ) {}

  async analyzeContract(file: Express.Multer.File, userId: string) {
    const record = this.repo.create({
      user_id: userId,
      document_name: file.originalname,
      analysis_status: 'processing',
    });
    await this.repo.save(record);

    try {
      // 1. Fetch User Financial Ledger Data and Persona
      const user = await this.repo.manager.findOne('User', { where: { id: userId } }) as any;
      const personaType = user?.persona_type || 'business';

      const metrics = await this.analyticsService.getDashboardMetrics(userId);
      const cashFlow = await this.analyticsService.getCashFlow(userId);

      let avgMonthlyIncome = user?.monthly_income || 0;
      let avgMonthlyExpense = user?.monthly_expense || 0;

      if (avgMonthlyIncome === 0) {
        if (cashFlow && cashFlow.length > 0) {
          const totalRev = cashFlow.reduce((acc, m) => acc + (Number(m.revenue) || 0), 0);
          avgMonthlyIncome = Math.round(totalRev / cashFlow.length);
        } else {
          avgMonthlyIncome = Math.round(metrics.totalRevenue / 12);
        }
      }

      if (avgMonthlyExpense === 0) {
        if (cashFlow && cashFlow.length > 0) {
          const totalExp = cashFlow.reduce((acc, m) => acc + (Number(m.expenses) || 0), 0);
          avgMonthlyExpense = Math.round(totalExp / cashFlow.length);
        } else {
          avgMonthlyExpense = Math.round(metrics.totalExpenses / 12);
        }
      }

      // Default baseline if completely empty
      if (avgMonthlyIncome === 0) avgMonthlyIncome = personaType === 'employee' ? 55000 : 65000;
      if (avgMonthlyExpense === 0) avgMonthlyExpense = personaType === 'employee' ? 22000 : 20000;

      const aiUrl = this.config.get('AI_SERVICE_URL', 'http://localhost:8000');
      const boundary = `----FormBoundary${Math.random().toString(16).slice(2)}`;
      const bodyParts: Buffer[] = [];
      
      // Pass contract_id, persona_type, and user financial ledger data
      bodyParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="contract_id"\r\n\r\n${record.id}\r\n`
      ));
      bodyParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="persona_type"\r\n\r\n${personaType}\r\n`
      ));
      bodyParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="monthly_income"\r\n\r\n${avgMonthlyIncome}\r\n`
      ));
      bodyParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="monthly_expense"\r\n\r\n${avgMonthlyExpense}\r\n`
      ));
      bodyParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="annual_revenue"\r\n\r\n${metrics.totalRevenue}\r\n`
      ));
      bodyParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.originalname}"\r\nContent-Type: ${file.mimetype || 'application/octet-stream'}\r\n\r\n`
      ));

      bodyParts.push(file.buffer);
      bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
      const body = Buffer.concat(bodyParts);

      const url = new URL(`${aiUrl}/analyze/contract`);
      const lib = url.protocol === 'https:' ? https : http;

      const data = await new Promise<any>((resolve, reject) => {
        const req = lib.request({
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
          },
        }, (res) => {
          let raw = '';
          res.on('data', chunk => raw += chunk);
          res.on('end', () => {
            try { 
              resolve(JSON.parse(raw)); 
            } catch { 
              reject(new Error(`Bad JSON response from AI service: ${raw.slice(0, 200)}`)); 
            }
          });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      // Save analysis overview with ledger impact
      await this.repo.update(record.id, {
        analysis_status: 'completed',
        chroma_collection_id: data.chroma_collection_id || `contract_${record.id.replace(/-/g, '_')}`,
        total_chunks: data.total_chunks || 0,
        executive_summary: data.executive_summary || [],
        red_flags: data.red_flags || [],
        borrower_rights: data.borrower_rights || [],
        clauses: data.clauses || [],
        simulation_results: data.simulation_results,
        decision: data.decision,
        ledger_impact: data.ledger_impact || null,
        negotiation_tips: data.negotiation_tips,
      });


      // Save individual structured clauses to table
      if (Array.isArray(data.clauses)) {
        const clauseEntities = data.clauses.map(c => this.clauseRepo.create({
          contract_id: record.id,
          clause_type: c.clause_type || 'General Clause',
          original_text: c.original_text || '',
          plain_explanation: c.simple_explanation || c.plain_explanation || '',
          risk_level: c.risk_level || 'Low',
          confidence: c.confidence || 'high',
          confidence_reason: c.confidence_reason || '',
          source_chunk_ids: c.source_chunk_ids || [],
          source_page: c.source_page || 1,
          financial_values: c.financial_values || {},
        }));
        await this.clauseRepo.save(clauseEntities);
      }


      return this.findOne(record.id, userId);
    } catch (err) {
      await this.repo.update(record.id, { analysis_status: 'failed' });
      throw err;
    }
  }

  async askQuestion(contractId: string, userId: string, question: string, topK: number = 4, language: string = 'en') {
    const contract = await this.repo.findOne({ where: { id: contractId, user_id: userId } });
    if (!contract) {
      throw new NotFoundException('Contract not found or access denied');
    }

    const aiUrl = this.config.get('AI_SERVICE_URL', 'http://localhost:8000');
    const postData = JSON.stringify({ question, top_k: topK, language });
    const url = new URL(`${aiUrl}/contracts/${contractId}/ask`);
    const lib = url.protocol === 'https:' ? https : http;

    const response = await new Promise<any>((resolve, reject) => {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error('Bad response from AI Q&A engine'));
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    // Save query to history
    const savedQuery = this.queryRepo.create({
      contract_id: contractId,
      question,
      answer: response.answer,
      cited_clauses: response.cited_clauses || [],
      confidence: response.confidence || 'high',
    });
    await this.queryRepo.save(savedQuery);

    return savedQuery;
  }

  async getQueries(contractId: string, userId: string) {
    const contract = await this.repo.findOne({ where: { id: contractId, user_id: userId } });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    return this.queryRepo.find({
      where: { contract_id: contractId },
      order: { created_at: 'ASC' },
    });
  }

  findAll(userId: string) {
    return this.repo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      relations: ['contract_clauses'],
    });
  }

  findOne(id: string, userId: string) {
    return this.repo.findOne({
      where: { id, user_id: userId },
      relations: ['contract_clauses', 'contract_queries'],
    });
  }

  async deleteContract(id: string, userId: string) {
    const contract = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Call AI service to purge Chroma collection
    try {
      const aiUrl = this.config.get('AI_SERVICE_URL', 'http://localhost:8000');
      const url = new URL(`${aiUrl}/contracts/${id}`);
      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'DELETE',
      });
      req.on('error', () => {});
      req.end();
    } catch {
      // ignore
    }

    await this.clauseRepo.delete({ contract_id: id });
    await this.queryRepo.delete({ contract_id: id });
    await this.repo.delete(id);
    return { success: true, message: 'Contract and analysis data deleted permanently.' };
  }

  async getLanguages() {
    const aiUrl = this.config.get('AI_SERVICE_URL', 'http://localhost:8000');
    const url = new URL(`${aiUrl}/languages`);
    const lib = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'GET',
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({ languages: {} });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  async translateContract(contractData: any, targetLanguage: string) {
    const aiUrl = this.config.get('AI_SERVICE_URL', 'http://localhost:8000');
    const url = new URL(`${aiUrl}/translate`);
    const lib = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify({ contract_data: contractData, target_language: targetLanguage });

    return new Promise((resolve, reject) => {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`Translation response error: ${raw}`));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
