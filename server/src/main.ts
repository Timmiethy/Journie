import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const clientUrl = configService.get<string>('CLIENT_URL', 'http://localhost:5173');
  const allowedOrigins = new Set<string>([clientUrl]);

  try {
    const parsedClientUrl = new URL(clientUrl);
    const port = parsedClientUrl.port ? `:${parsedClientUrl.port}` : '';
    allowedOrigins.add(`http://localhost${port}`);
    allowedOrigins.add(`http://127.0.0.1${port}`);
  } catch {
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://127.0.0.1:5173');
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/api`);
}

bootstrap();
