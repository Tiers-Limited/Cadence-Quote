
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiLock } from "react-icons/fi";
import { Spin, message } from "antd";
import { useVerify2FA } from "../hooks/useVerify2FA";
import { useAuth } from "../hooks/useAuth";
import Logo from "../components/Logo";

function TwoFactorVerificationPage() {
  const [code, setCode] = useState("");
  const { verify2FA, loading, error } = useVerify2FA();
  const { login: contextLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Extract userId and email from location state
  const { userId, email } = location.state || {};

  useEffect(() => {
    if (!userId || !email) {
      message.error("Invalid access. Please log in again.");
      navigate("/login");
    }
  }, [userId, email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!code) {
      message.error("Please enter the 2FA code");
      return;
    }

    const result = await verify2FA(userId, code);
    if (result.success) {
      message.success("Two-factor authentication successful!");
      console.log("Data",result)
      contextLogin(
        result.data.user,
        result.data.token,
        result.data.refreshToken
      );
      navigate("/dashboard");
    } else {
      message.error(result.error || "Invalid or expired 2FA code");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo width={100} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h1>
          <p className="text-gray-600">Enter the code sent to {email}</p>
        </div>

        {/* 2FA Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 2FA Code Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Authentication Code
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  placeholder="Enter 6-digit code"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  disabled={loading}
                  maxLength={6}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Spin size="small" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </button>
          </form>

          {/* Resend Link */}
          <p className="mt-6 text-center text-gray-600">
            Didn't receive a code?{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 font-semibold">
              Resend code
            </a>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          Secure your account with two-factor authentication
        </p>
      </div>
    </div>
  );
}

export default TwoFactorVerificationPage;