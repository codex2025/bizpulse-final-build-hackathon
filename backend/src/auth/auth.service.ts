import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    
    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        business_name: user.business_name,
        persona_type: user.persona_type || 'business',
        job_title: user.job_title,
        monthly_income: user.monthly_income,
      },
    };
  }

  async register(dto: any) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      ...dto,
      persona_type: dto.persona_type || 'business',
      password: hashedPassword,
    });

    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        business_name: user.business_name,
        persona_type: user.persona_type || 'business',
        job_title: user.job_title,
        monthly_income: user.monthly_income,
      },
    };
  }

  async firebaseAuth(dto: any) {
    let user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      const dummyPassword = await bcrypt.hash(Math.random().toString(36), 10);
      user = await this.usersService.create({
        email: dto.email,
        full_name: dto.full_name || dto.email.split('@')[0],
        business_name: dto.business_name || '',
        persona_type: dto.persona_type || 'business',
        job_title: dto.job_title || '',
        monthly_income: dto.monthly_income || 0,
        password: dummyPassword,
      });
    } else if (dto.persona_type && dto.persona_type !== user.persona_type) {
      const updated = await this.usersService.update(user.id, {
        persona_type: dto.persona_type,
        ...(dto.full_name && !user.full_name ? { full_name: dto.full_name } : {}),
        ...(dto.business_name && !user.business_name ? { business_name: dto.business_name } : {}),
      });
      if (updated) user = updated;
    }

    if (!user) throw new UnauthorizedException('Authentication failed');

    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        business_name: user.business_name,
        persona_type: user.persona_type || 'business',
        job_title: user.job_title,
        monthly_income: user.monthly_income,
      },
    };
  }
}

