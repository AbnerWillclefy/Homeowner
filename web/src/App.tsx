import { AppRoutes } from "./app/AppRoutes";
import { AuthProvider } from "./app/AuthProvider";

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
