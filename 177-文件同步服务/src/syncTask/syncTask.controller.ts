import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SyncTaskService } from './syncTask.service';
import { CreateSyncTaskDto } from './dto/create-syncTask.dto';
@Controller('sync-tasks')
export class SyncTaskController {
  constructor(private readonly service: SyncTaskService) {}
  @Post() create(@Body() dto: CreateSyncTaskDto) {
    return this.service.create(dto);
  }
  @Get() findAll(@Query() query: any) {
    return this.service.findAll(query);
  }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.service.update(id, dto);
  }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
