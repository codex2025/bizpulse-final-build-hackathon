import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) return null;
    const { password, ...result } = user;
    return result;
  }

  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() updateData: any) {
    const user = await this.usersService.update(req.user.userId, updateData);
    if (!user) return null;
    const { password, ...result } = user;
    return result;
  }
}
