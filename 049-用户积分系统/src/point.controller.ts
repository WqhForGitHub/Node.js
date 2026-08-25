import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { PointService } from './point.service';
@Controller('points')
export class PointController {
  constructor(private readonly service: PointService) {}
  @Post() create(@Body() dto: any) {
    return this.service.create(dto);
  }
  @Get() findAll() {
    return this.service.findAll();
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
  @Post(':action/:name') action(@Param('name') name: string, @Body() payload: any) {
    return this.service.action(name, payload);
  }
}
