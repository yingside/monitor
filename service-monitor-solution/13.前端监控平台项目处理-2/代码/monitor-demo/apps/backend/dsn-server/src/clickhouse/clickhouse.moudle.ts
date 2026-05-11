import { DynamicModule, Global, Module } from "@nestjs/common";
import { createClient } from "@clickhouse/client";

@Global()
@Module({})
export class CLickhouseModule {
  static forRoot(options: { url: string; username: string; password: string }): DynamicModule {
    return {
      module: CLickhouseModule,
      providers: [
        {
          provide: "CLICKHOUSE_CLIENT",
          useFactory: () => {
            return createClient(options);
          }
        }
      ],
      exports: ["CLICKHOUSE_CLIENT"]
    };
  }
}
