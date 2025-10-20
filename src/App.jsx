

import { BrowserRouter as Router } from "react-router-dom";
import { UserProvider } from "./context/UserContext";
import AppRoutes from "./routes";
import { ConfigProvider } from "antd";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#4a8bff",
          borderRadius: 6,
        },
      }}
    >
      <Router>
        <UserProvider>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
            <AppRoutes />
            <Toaster position="top-right" />
          </div>
        </UserProvider>
      </Router>
    </ConfigProvider>
  );
}

export default App;
