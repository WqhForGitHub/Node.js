import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
@Controller('admin')
export class AdminController {
  @Get('dashboard') @Roles('admin') dashboard() {
    return { message: 'admin only area' };
  }
  @Get('content') @Roles('admin', 'editor') content() {
    return { items: [1, 2, 3] };
  }
}
