import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { resolveJwtSecret } from './jwt-secret';
import { firebaseVerifierProvider } from './firebase-token.verifier';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Fails to start in production without a strong JWT_SECRET; random per process in development (see jwt-secret.ts).
        secret: resolveJwtSecret(config.get<string>('JWT_SECRET')),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') || '7d') as any },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, firebaseVerifierProvider],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
