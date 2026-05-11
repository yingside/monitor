import { createBrowserRouter } from "react-router";
import { Login } from "@/pages/Login";
import AuthRoute from "./AuthRoute";
import { Layout } from "@/layout";
import { Issues } from "@/pages/Issues";
import { Projects } from "@/pages/Projects";

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
        element: <Projects />
      },
      {
        path: "issues",
        element: <Issues />
      }
    ]
  },
  {
    path: "/login",
    element: <Login />
  }
]);
