import { createBrowserRouter } from "react-router";
import { Login } from "@/pages/Login";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <div>根目录</div>,
    children: [
      {
        path: "projects",
        element: <div>projects</div>
      },
      {
        path: "issues",
        element: <div>issues</div>
      }
    ]
  },
  {
    path: "/login",
    element: <Login />
  }
]);
