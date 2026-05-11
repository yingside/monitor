import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { StorageService } from "./storage.service";

@Controller("storage")
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get("/bugs")
  bugs() {
    return this.storageService.bugs();
  }

  @Get("/data")
  getData() {
    return this.storageService.getData();
  }

  @Post("/tracing/:app_id")
  async tracing(@Param() { app_id }: { app_id: string }, @Body() body: any) {
    await this.storageService.tracing(app_id, body);
    return { message: "Tracing data inserted successfully" };
  }
}
