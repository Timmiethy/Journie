import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user';
import { JournalService } from './journal.service';
import { GenerationService } from './generation/generation.service';
import { GenerateJournalDto } from './dto/generate-journal.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';

@Controller('journal')
@UseGuards(AuthGuard)
export class JournalController {
  constructor(
    private journalService: JournalService,
    private generationService: GenerationService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(
    @CurrentUser() user: { id: string },
    @Body() body: GenerateJournalDto,
  ) {
    return this.generationService.generate(user.id, body.date, body.regenerate);
  }

  @Get(':date')
  async findByDate(
    @CurrentUser() user: { id: string },
    @Param('date') date: string,
  ) {
    return this.journalService.findByDate(user.id, date);
  }

  @Patch(':date')
  async update(
    @CurrentUser() user: { id: string },
    @Param('date') date: string,
    @Body() body: UpdateJournalDto,
  ) {
    return this.journalService.update(user.id, date, body);
  }
}

@Controller('journals')
@UseGuards(AuthGuard)
export class JournalsController {
  constructor(private journalService: JournalService) {}

  @Get()
  async list(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.journalService.listByUser(
      user.id,
      limit ? parseInt(limit) : 30,
      offset ? parseInt(offset) : 0,
      status,
    );
  }
}
