import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const AUTH_RETRY_DELAYS_MS = [0, 300, 1000];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
}

function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '');
  }
  return '';
}

function isTransientAuthError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = getErrorCode(error).toUpperCase();

  return (
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('network') ||
    code === 'ETIMEDOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const supabase = this.supabaseService.getClient();

    for (let attempt = 0; attempt < AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
      const delayMs = AUTH_RETRY_DELAYS_MS[attempt];
      if (delayMs > 0) {
        await sleep(delayMs);
      }

      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);

        if (error) {
          if (isTransientAuthError(error) && attempt < AUTH_RETRY_DELAYS_MS.length - 1) {
            this.logger.warn(
              `Transient auth validation error on attempt ${attempt + 1}/${AUTH_RETRY_DELAYS_MS.length}: ${getErrorMessage(error)}`,
            );
            continue;
          }

          if (isTransientAuthError(error)) {
            throw new ServiceUnavailableException('Auth service unavailable');
          }

          throw new UnauthorizedException('Invalid token');
        }

        if (!user) {
          throw new UnauthorizedException('Invalid token');
        }

        request.user = user;
        return true;
      } catch (error) {
        if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) {
          throw error;
        }

        if (isTransientAuthError(error) && attempt < AUTH_RETRY_DELAYS_MS.length - 1) {
          this.logger.warn(
            `Transient auth validation exception on attempt ${attempt + 1}/${AUTH_RETRY_DELAYS_MS.length}: ${getErrorMessage(error)}`,
          );
          continue;
        }

        if (isTransientAuthError(error)) {
          throw new ServiceUnavailableException('Auth service unavailable');
        }

        throw error;
      }
    }

    throw new ServiceUnavailableException('Auth service unavailable');
  }
}
