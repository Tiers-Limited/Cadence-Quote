import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Alert, Card } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import apiService from '../services/apiService';
import Logo from '../components/Logo';

const ClientResetPassword = () => {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
      setValidating(false);
      return;
    }

    // Validate token on mount
    const validateToken = async () => {
      try {
        await apiService.get(`/api/client-auth/validate-reset-token?token=${token}`);
        setTokenValid(true);
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid or expired reset token');
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (values) => {
    setLoading(true);
    setError(null);

    try {
      await apiService.post('/api/client-auth/reset-password', {
        token,
        newPassword: values.password
      });
      
      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (_, value) => {
    if (!value || value.length < 8) {
      return Promise.reject('Password must be at least 8 characters');
    }
    if (!/(?=.*[a-z])/.test(value)) {
      return Promise.reject('Password must contain at least one lowercase letter');
    }
    if (!/(?=.*[A-Z])/.test(value)) {
      return Promise.reject('Password must contain at least one uppercase letter');
    }
    if (!/(?=.*\d)/.test(value)) {
      return Promise.reject('Password must contain at least one number');
    }
    return Promise.resolve();
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <Card loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo width={100} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Set New Password</h1>
          <p className="text-gray-600 mt-2">
            Enter your new password below
          </p>
        </div>

        {/* Form Card */}
        <Card className="shadow-lg">
          {(() => {
            if (tokenValid === false) {
              return (
                <div className="text-center py-4">
                  <Alert
                    message="Invalid Reset Link"
                    description={error || "This password reset link is invalid or has expired. Please request a new one."}
                    type="error"
                    showIcon
                    className="mb-4"
                  />
                  <Link to="/client/forgot-password">
                    <Button type="primary" size="large" block>
                      Request New Link
                    </Button>
                  </Link>
                </div>
              );
            }
            
            if (success) {
              return (
                <div className="text-center py-4">
                  <Alert
                    message="Password Reset Successful!"
                    description="Your password has been reset. Redirecting to login..."
                    type="success"
                    showIcon
                    className="mb-4"
                  />
                </div>
              );
            }
            
            return (
            <>
              {error && (
                <Alert
                  message="Error"
                  description={error}
                  type="error"
                  closable
                  onClose={() => setError(null)}
                  className="mb-4"
                  showIcon
                />
              )}

              <Form
                form={form}
                onFinish={handleSubmit}
                layout="vertical"
                requiredMark={false}
              >
                <Form.Item
                  label="New Password"
                  name="password"
                  rules={[
                    { required: true, message: 'Please enter your new password' },
                    { validator: validatePassword }
                  ]}
                  hasFeedback
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Enter new password"
                    size="large"
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item
                  label="Confirm Password"
                  name="confirmPassword"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Please confirm your password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject('Passwords do not match');
                      },
                    }),
                  ]}
                  hasFeedback
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Confirm new password"
                    size="large"
                    disabled={loading}
                  />
                </Form.Item>

                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Password requirements:</p>
                  <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                    <li>At least 8 characters long</li>
                    <li>Contains at least one uppercase letter</li>
                    <li>Contains at least one lowercase letter</li>
                    <li>Contains at least one number</li>
                  </ul>
                </div>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={loading}
                    block
                  >
                    Reset Password
                  </Button>
                </Form.Item>
              </Form>

              <div className="text-center mt-4">
                <Link to="/login" className="text-blue-600 hover:text-blue-700">
                  Back to Login
                </Link>
              </div>
            </>
            );
          })()}
        </Card>
      </div>
    </div>
  );
};

export default ClientResetPassword;
