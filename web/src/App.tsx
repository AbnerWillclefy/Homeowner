import { AppRoutes } from "./app/components/AppRoutes";
import { AuthProvider } from "./app/components/AuthProvider";

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
