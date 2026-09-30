import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { pickProfileFields, publicUser } from './profile-fields';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    return user ? publicUser(user) : null;
  }

  /** Only profile fields are writable here; email, password and the linked Google identity are not. */
  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() body: any) {
    const user = await this.usersService.update(req.user.userId, pickProfileFields(body));
    return user ? publicUser(user) : null;
  }
}
