import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase/supabase.service';
import { AuthGuard } from './guards/auth.guard';

@Global()
@Module({
  providers: [SupabaseService, AuthGuard],
  exports: [SupabaseService, AuthGuard],
})
export class CommonModule {}
