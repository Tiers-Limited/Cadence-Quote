import React, { useState } from 'react';
import { Form, Input, Button, Alert, Card } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import apiService from '../services/apiService';
import Logo from '../components/Logo';

const ClientForgotPassword = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (values) => {
    setLoading(true);
    setError(null);

    try {
      await apiService.post('/api/client-auth/forgot-password', {
        email: values.email
      });
      
      setSuccess(true);
      form.resetFields();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo width={100} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-600 mt-2">
            Enter your email address and we'll send you instructions to reset your password
          </p>
        </div>

        {/* Form Card */}
        <Card className="shadow-lg">
          {success ? (
            <div className="text-center py-4">
              <Alert
                message="Email Sent!"
                description="If an account exists with that email address, you will receive password reset instructions shortly."
                type="success"
                showIcon
                className="mb-4"
              />
              <Link to="/login">
                <Button type="primary" size="large" block>
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
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
                  label="Email Address"
                  name="email"
                  rules={[
                    { required: true, message: 'Please enter your email' },
                    { type: 'email', message: 'Please enter a valid email' }
                  ]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder="you@example.com"
                    size="large"
                    disabled={loading}
                  />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={loading}
                    block
                  >
                    Send Reset Link
                  </Button>
                </Form.Item>
              </Form>

              <div className="text-center mt-4">
                <Link to="/login" className="text-blue-600 hover:text-blue-700">
                  Back to Login
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ClientForgotPassword;
