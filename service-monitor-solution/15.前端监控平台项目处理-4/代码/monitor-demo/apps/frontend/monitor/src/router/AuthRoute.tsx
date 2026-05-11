import { Navigate } from "react-router";

interface AuthRouteProps {
  children: React.ReactNode;
}
const AuthRoute = ({ children }: AuthRouteProps) => {
  // 如果用户没有登录，重定向到登录页面
  if (!localStorage.getItem("token")) {
    return <Navigate to={`login?redirect=${window.location.pathname}`} />;
  }

  // 如果用户已登录，渲染子组件
  return children;
};

export default AuthRoute;
