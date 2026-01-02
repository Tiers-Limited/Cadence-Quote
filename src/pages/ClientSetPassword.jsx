import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message, Alert } from 'antd';
import { FiLock } from 'react-icons/fi';
import { apiService } from '../services/apiService';

const { Title, Text, Paragraph } = Typography;

function ClientSetPassword() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const token = searchParams.get('token');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <Alert
            message="Invalid Link"
            description="This invitation link is invalid or has expired. Please contact your contractor for a new invitation."
            type="error"
            showIcon
          />
        </Card>
      </div>
    );
  }

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      const response = await apiService.post('/client-auth/set-password', {
        token,
        password: values.password
      });

      if (response.success) {
        message.success('Password set successfully!');
        setSuccess(true);
        
        // Store token and user data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Redirect to customer portal after 2 seconds
        setTimeout(() => {
          navigate('/portal/dashboard');
        }, 2000);
      }
    } catch (error) {
      message.error(error.message || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <Title level={3}>Password Set Successfully!</Title>
          <Paragraph>
            Redirecting you to your customer portal...
          </Paragraph>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <div className="text-center mb-6">
          <Title level={2}>Welcome to Customer Portal</Title>
          <Paragraph type="secondary">
            Create your password to access your quotes and project details
          </Paragraph>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter a password' },
              { min: 8, message: 'Password must be at least 8 characters' }
            ]}
          >
            <Input.Password
              prefix={<FiLock />}
              placeholder="Enter password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<FiLock />}
              placeholder="Confirm password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
            >
              Set Password & Login
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center mt-4">
          <Text type="secondary">
            Your password must be at least 8 characters long
          </Text>
        </div>
      </Card>
    </div>
  );
}

export default ClientSetPassword;
