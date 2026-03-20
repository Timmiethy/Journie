import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase/supabase.service';
import { AuthGuard } from './guards/auth.guard';
import { HealthController } from './health.controller';

@Global()
@Module({
  providers: [SupabaseService, AuthGuard],
  exports: [SupabaseService, AuthGuard],
  controllers: [HealthController],
})
export class CommonModule {}
