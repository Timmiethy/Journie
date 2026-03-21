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
import { WeeklyService } from './generation/weekly.service';
import { GenerateJournalDto } from './dto/generate-journal.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { GenerateWeeklyDto } from './dto/generate-weekly.dto';

@Controller('journal')
@UseGuards(AuthGuard)
export class JournalController {
  constructor(
    private journalService: JournalService,
    private generationService: GenerationService,
    private weeklyService: WeeklyService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(
    @CurrentUser() user: { id: string },
    @Body() body: GenerateJournalDto,
  ) {
    return this.generationService.generate(user.id, body.date, body.regenerate, body.momentIds);
  }

  @Post('generate-weekly')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateWeekly(
    @CurrentUser() user: { id: string },
    @Body() body: GenerateWeeklyDto,
  ) {
    return this.weeklyService.generateWeekly(user.id, body.week_start);
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
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('entry_type') entryType?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 30;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    return this.journalService.listByUser(
      user.id,
      Number.isNaN(parsedLimit) || parsedLimit < 1 ? 30 : Math.min(parsedLimit, 100),
      Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset,
      status,
      from,
      to,
      entryType,
    );
  }
}
