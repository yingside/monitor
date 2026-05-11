import { Body, Controller, Get, Post } from "@nestjs/common";
import { StorageService } from "./storage.service";

@Controller("storage")
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get("/data")
  getData() {
    return this.storageService.getData();
  }

  @Post("/tracing")
  async tracing(@Body() body: any) {
    await this.storageService.tracing(body);
    return { message: "Tracing data inserted successfully" };
  }
}
