import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any) {
    return this.authService.login(body?.email, body?.password);
  }

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  /**
   * Google sign-up and sign-in in one call. The body is `{ idToken }` (a Firebase ID token from the Google popup) plus
   * optional profile choices for a new account. The token is verified against Google's keys; nothing about who the
   * person is is taken from the body. (This replaces the old `firebase-login` route, which trusted a client-supplied
   * email and so let anyone sign in as anyone.)
   */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async google(@Body() body: any) {
    return this.authService.googleAuth(body);
  }
}
