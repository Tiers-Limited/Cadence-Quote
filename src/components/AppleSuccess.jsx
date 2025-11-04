"use client";

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Client, Account } from "appwrite";
import { message, Spin } from "antd";
import { FaApple } from "react-icons/fa";
import { useLogin } from "../hooks/useLogin";
import { useAuth } from "../hooks/useAuth";

export default function AuthSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const appDataParam = searchParams.get("appData");
  const { login } = useLogin();
  const { login: contextLogin } = useAuth();

  useEffect(() => {
    const handleAuthSuccess = async () => {
      try {
        const client = new Client()
          .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
          .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

        const account = new Account(client);
        const user = await account.get();

        let appData = {};
        if (appDataParam) {
          try {
            appData = JSON.parse(decodeURIComponent(appDataParam));
          } catch (e) {
            console.warn("Invalid appData:", e);
          }
        }

        // Construct the Apple user data object
        const appleData = {
          fullName: user.name || "",
          email: user.email || "",
          appleId: user.$id,
          authProvider: "apple",
          ...appData,
        };

        if (!appleData.email) {
          throw new Error("No email found in Apple user data");
        }

        message.success("Apple sign-in successful!");

        if (mode === "login") {
          try {
            const email = user.email;
            const authProvider = "apple";
            const result = await login(email, authProvider);

            if (result.success) {
              if (result.requiresTwoFactor) {
                navigate("/verify-2fa", {
                  state: {
                    userId: result.data.userId,
                    email: result.data.email,
                  },
                });
              } else {
                contextLogin(
                  result.data.user,
                  result.data.token,
                  result.data.refreshToken
                );
                navigate("/dashboard");
              }
            } else {
              message.error(result.message || "Login failed");
              navigate("/auth/failure");
            }
          } catch (loginErr) {
            console.error("Apple login error:", loginErr);
            message.error(
              loginErr.response?.data?.message ||
                "Login failed. Please try again."
            );
            navigate("/auth/failure");
          }
        } else {
          // 🔹 Handle Signup Flow
          const encodedAppleData = encodeURIComponent(
            JSON.stringify(appleData)
          );
          setTimeout(() => {
            navigate(`/register?mode=signup&appleData=${encodedAppleData}`);
          }, 800);
        }
      } catch (err) {
        console.error("Apple success handler error:", err);
        message.error("Authentication failed");
        navigate("/auth/failure");
      }
    };

    handleAuthSuccess();
  }, [navigate, mode, appDataParam, contextLogin]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-white text-black">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-gray-200 shadow-sm">
        <FaApple size={40} className="text-black" />
        <p className="text-lg font-medium tracking-wide">
          Completing your Apple sign-in…
        </p>
        <Spin size="large" />
      </div>
      <p className="mt-8 text-sm text-gray-500">
        Please wait while we connect your account securely.
      </p>
    </div>
  );
}
