import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user';
import { MomentsService } from './moments.service';
import { CreateMomentDto } from './dto/create-moment.dto';
import { ReorderMomentsDto } from './dto/reorder-moments.dto';

@Controller('moments')
@UseGuards(AuthGuard)
export class MomentsController {
  constructor(private momentsService: MomentsService) {}

  @Get()
  async findByDate(
    @CurrentUser() user: { id: string },
    @Query('date') date: string,
  ) {
    return this.momentsService.findByDate(user.id, date);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('photos'))
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateMomentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.momentsService.create(user.id, dto, files);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    await this.momentsService.remove(user.id, id);
  }

  @Patch('reorder')
  async reorder(
    @CurrentUser() user: { id: string },
    @Body() dto: ReorderMomentsDto,
  ) {
    await this.momentsService.reorder(user.id, dto);
  }
}
