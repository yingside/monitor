import { ClickHouseClient } from "@clickhouse/client";
import { Inject, Injectable } from "@nestjs/common";

@Injectable()
export class StorageService {
  constructor(@Inject("CLICKHOUSE_CLIENT") private readonly clickhouseClient: ClickHouseClient) {}

  async getData() {
    const res = await this.clickhouseClient.query({
      query: "SELECT * FROM monitor_view",
      format: "JSON"
    });
    const json = await res.json();
    return json.data;
  }

  async tracing(body: any) {
    const values = {
      app_id: body.app_id || "1",
      event_type: body.event_type || "default_event",
      message: body.message || "No message provided",
      info: body || {}
    };

    await this.clickhouseClient.insert({
      table: "monitor_storage",
      columns: ["app_id", "event_type", "message", "info"],
      values,
      format: "JSONEachRow"
    });
  }
}
