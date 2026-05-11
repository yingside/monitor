import { CreateApplicationPayload } from "@/types/api";
import { request } from "@/utils/request";

/**
 * 获取应用列表
 */
export const fetchApplicationList = async () => {
  const list = await request.get("/application");
  console.log(list);
  return list;
};

/**
 * 创建应用
 */
export const createApplication = async (data: CreateApplicationPayload) => {
  return await request.post("/application", data);
};
