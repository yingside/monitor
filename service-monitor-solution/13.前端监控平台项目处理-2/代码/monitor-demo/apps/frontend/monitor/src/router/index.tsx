import { createBrowserRouter } from "react-router";
import { Login } from "@/pages/Login";
import AuthRoute from "./AuthRoute";
import { Layout } from "@/layout";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthRoute>
        <Layout />
      </AuthRoute>
    ),
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
