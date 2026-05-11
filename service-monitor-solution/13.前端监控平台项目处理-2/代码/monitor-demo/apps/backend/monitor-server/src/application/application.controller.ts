import { Controller, Get, Post, Body, Patch, Param, Delete } from "@nestjs/common";
import { ApplicationService } from "./application.service";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationDto } from "./dto/update-application.dto";
import { Admin } from "src/admin/entities/admin.entity";
import { Application } from "./entities/application.entity";

@Controller("application")
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post()
  create(@Body() body) {
    const admin = new Admin();
    admin.id = 1; // 测试
    const application = new Application(body);
    application.admin = admin; // 关联管理员

    return this.applicationService.create(application);
  }

  @Get()
  findAll() {
    return this.applicationService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.applicationService.findOne(+id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateApplicationDto: UpdateApplicationDto) {
    return this.applicationService.update(+id, updateApplicationDto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.applicationService.remove(+id);
  }
}
