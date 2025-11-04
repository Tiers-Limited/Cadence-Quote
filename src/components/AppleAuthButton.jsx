"use client";

import { FaApple } from "react-icons/fa";
import { message } from "antd";
import PropTypes from "prop-types";
import { Client, Account } from "appwrite";

function AppleAuthButton({ mode = "login", appData = {}, onSuccess, onError }) {
  const handleAppleAuth = async () => {
    try {
      const client = new Client()
        .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
        .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

      const account = new Account(client);

      // Encode any additional data you want to send
      const encodedAppData = encodeURIComponent(JSON.stringify(appData));

      const successUrl = `${window.location.origin}/auth/apple/success?mode=${mode}&appData=${encodedAppData}`;
      const failureUrl = `${window.location.origin}/auth/failure`;

      // Redirect user to Apple OAuth
      await account.createOAuth2Session("apple", successUrl, failureUrl);
    } catch (error) {
      console.error("Apple auth error:", error);
      message.error(`Failed to initialize Apple authentication: ${error.message}`);
      if (onError) onError(error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleAppleAuth}
      className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-900 bg-black rounded-lg font-semibold text-white hover:bg-gray-900 transition duration-200 shadow-sm"
    >
      <FaApple size={24} />
      <span>
        {mode === "signup" ? "Sign up with Apple" : "Continue with Apple"}
      </span>
    </button>
  );
}

AppleAuthButton.propTypes = {
  mode: PropTypes.oneOf(["login", "signup"]),
  appData: PropTypes.object,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};

export default AppleAuthButton;
