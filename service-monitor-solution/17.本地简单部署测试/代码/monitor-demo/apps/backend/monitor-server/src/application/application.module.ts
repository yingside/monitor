import { Module } from "@nestjs/common";
import { ApplicationService } from "./application.service";
import { ApplicationController } from "./application.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Application } from "./entities/application.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Application])], // Specify entities if any
  controllers: [ApplicationController],
  providers: [ApplicationService]
})
export class ApplicationModule {}
