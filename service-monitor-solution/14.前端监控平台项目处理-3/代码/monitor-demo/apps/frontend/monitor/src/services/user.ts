import { CurrentUserRes, LoginPayload, LoginRes } from "@/types/api";
import { request } from "@/utils/request";

/**
 * 用户登录
 */
export const login = async (data: LoginPayload) => {
  return await request.post("/auth/login", data);
};

/**
 * 获取当前用户信息
 */
export const currentUser = async (): Promise<CurrentUserRes> => {
  return await request.get("/auth/whoami");
};

/**
 * 用户注册
 */
export const register = async (data: { username: string; password: string }): Promise<void> => {
  return await request.post("/admin/register", data);
};
