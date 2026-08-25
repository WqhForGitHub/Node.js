import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const tenant = req.headers['x-tenant-id'];
    if (!tenant) throw new BadRequestException('Missing x-tenant-id header');
    req.tenantId = tenant;
    return true;
  }
}
