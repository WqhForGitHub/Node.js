import { Module } from '@nestjs/common';
import { OssObjectController } from './ossObject.controller';
import { OssObjectService } from './ossObject.service';
@Module({ controllers: [OssObjectController], providers: [OssObjectService] })
export class OssObjectModule {}
