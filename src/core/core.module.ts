import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtStrategy } from './jwt.strategy';

@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  exports: [HttpModule],
  providers: [JwtStrategy],
})
export class CoreModule {}
