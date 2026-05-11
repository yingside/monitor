import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards } from "@nestjs/common";
import { ApplicationService } from "./application.service";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationDto } from "./dto/update-application.dto";
import { Admin } from "src/admin/entities/admin.entity";
import { Application } from "./entities/application.entity";
import { nanoid } from "nanoid";
import { AuthGuard } from "@nestjs/passport";

@Controller("application")
@UseGuards(AuthGuard("jwt")) // req的数据来自Jwt的拦截器
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post()
  create(@Body() body, @Request() req) {
    const admin = new Admin();
    admin.id = req.user.id; // 测试
    const application = new Application(body);
    application.appId = application.type + nanoid(6); // 生成应用ID
    application.admin = admin; // 关联管理员

    return this.applicationService.create(application);
  }

  @Get()
  async findAll(@Request() req) {
    console.log(req.user); // 打印当前用户信息，便于调试
    const list = await this.applicationService.findAll({ userId: req.user.id }); // 获取当前用户的应用列表
    console.log(list);
    return {
      data: list,
      success: true
    };
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
