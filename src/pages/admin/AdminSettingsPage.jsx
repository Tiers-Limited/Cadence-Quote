import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Tabs, message, Spin, Segmented, Popconfirm } from 'antd';
import { FiSettings, FiUser, FiLock, FiSave } from 'react-icons/fi';
import { apiService } from '../../services/apiService';

const { TextArea } = Input;
const { TabPane } = Tabs;

function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);

  const [infoForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    fetchAdminSettings();
  }, []);

  const fetchAdminSettings = async () => {
    setLoading(true);
    try {
      // Fetch admin user info
      const userResponse = await apiService.get('/admin/settings/profile');
      if (userResponse.success) {
        infoForm.setFieldsValue({
          fullName: userResponse.data.fullName,
          email: userResponse.data.email
        });
      }

      // Fetch 2FA status
      const twoFactorData = await apiService.get('/auth/2fa-status');
      if (twoFactorData.success) {
        setTwoFactorEnabled(twoFactorData.data.twoFactorEnabled || false);
      }
    } catch (error) {
      console.error('Error fetching admin settings:', error);
      message.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInfo = async (values) => {
    setSubmitting(true);
    try {
      const response = await apiService.put('/admin/settings/profile', {
        fullName: values.fullName,
        email: values.email
      });

      if (response.success) {
        message.success('Profile updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      message.error(error.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (values) => {
    setSubmitting(true);
    try {
      const response = await apiService.post('/admin/settings/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      if (response.success) {
        message.success('Password changed successfully');
        passwordForm.resetFields();
      }
    } catch (error) {
      console.error('Error changing password:', error);
      message.error(error.message || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnable2FA = async () => {
    setSubmitting(true);
    try {
      const response = await apiService.post('/auth/enable-2fa', {});
      if (response.success) {
        setTwoFactorEnabled(true);
        setQrCodeUrl(response.data.qrCodeUrl);
        message.success('Two-factor authentication enabled successfully');
      }
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      message.error('Failed to enable 2FA');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable2FA = async () => {
    setSubmitting(true);
    try {
      const response = await apiService.post('/auth/disable-2fa');
      if (response.success) {
        setTwoFactorEnabled(false);
        setQrCodeUrl(null);
        message.success('Two-factor authentication disabled');
      }
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      message.error('Failed to disable 2FA');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Loading settings..." />
      </div>
    );
  }

  return (
    <div className=''>
      <div className='max-w-6xl mx-auto'>
        {/* Header */}
        <div className='mb-6'>
          <div className='flex items-center gap-3 mb-2'>
            <FiSettings className='text-3xl text-blue-600' />
            <h1 className='text-3xl font-bold text-gray-900'>Settings</h1>
          </div>
          <p className='text-gray-600'>
            Manage your admin profile and account security
          </p>
        </div>

        {/* Tabs */}
        <Card>
          <div className='mb-4'>
            <Segmented
              value={activeTab}
              onChange={(val) => setActiveTab(val)}
              options={[
                { label: 'Profile Info', value: 'info' },
                { label: 'Account', value: 'account' }
              ]}
              className='ant-segmented--rounded'
              block
            />
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type='card'
            size='large'
            tabBarStyle={{ display: 'none' }}
          >
            {/* Profile Info Tab */}
            <TabPane
              tab={
                <span className='flex items-center gap-2'>
                  <FiUser />
                  Profile Info
                </span>
              }
              key='info'
            >
              <div className='py-4'>
                <h3 className='text-lg font-semibold mb-4'>
                  Profile Information
                </h3>
                <Form
                  form={infoForm}
                  layout='vertical'
                  onFinish={handleUpdateInfo}
                  className='max-w-2xl'
                >
                  <Form.Item
                    label='Full Name'
                    name='fullName'
                    rules={[
                      { required: true, message: 'Please enter your full name' }
                    ]}
                  >
                    <Input size='large' placeholder='John Doe' />
                  </Form.Item>

                  <Form.Item
                    label='Email'
                    name='email'
                    rules={[
                      { required: true, message: 'Please enter email' },
                      { type: 'email', message: 'Please enter a valid email' }
                    ]}
                  >
                    <Input size='large' placeholder='admin@example.com' disabled />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type='primary'
                      htmlType='submit'
                      icon={<FiSave />}
                      loading={submitting}
                      size='large'
                    >
                      Save Profile Info
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            </TabPane>

            {/* Account Tab */}
            <TabPane
              tab={
                <span className='flex items-center gap-2'>
                  <FiSettings />
                  Account
                </span>
              }
              key='account'
            >
              <div className='py-4'>
                <h3 className='text-lg font-semibold mb-4'>Account Settings</h3>
                <div className='max-w-2xl space-y-4'>
                  <Card>
                    <h4 className='font-semibold mb-2'>Password</h4>
                    <p className='text-gray-600 text-sm mb-3'>
                      Change your account password
                    </p>
                    <Form
                      form={passwordForm}
                      layout='vertical'
                      onFinish={handleChangePassword}
                    >
                      <Form.Item
                        label='Current Password'
                        name='currentPassword'
                        rules={[
                          { required: true, message: 'Please enter your current password' }
                        ]}
                      >
                        <Input.Password
                          size='large'
                          placeholder='Enter current password'
                        />
                      </Form.Item>

                      <Form.Item
                        label='New Password'
                        name='newPassword'
                        rules={[
                          { required: true, message: 'Please enter a new password' },
                          { min: 8, message: 'Password must be at least 8 characters' }
                        ]}
                      >
                        <Input.Password
                          size='large'
                          placeholder='Enter new password'
                        />
                      </Form.Item>

                      <Form.Item
                        label='Confirm New Password'
                        name='confirmPassword'
                        dependencies={['newPassword']}
                        rules={[
                          { required: true, message: 'Please confirm your new password' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('newPassword') === value) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error('Passwords do not match'));
                            },
                          }),
                        ]}
                      >
                        <Input.Password
                          size='large'
                          placeholder='Confirm new password'
                        />
                      </Form.Item>

                      <Form.Item>
                        <Button
                          type='primary'
                          htmlType='submit'
                          icon={<FiLock />}
                          loading={submitting}
                        >
                          Change Password
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>

                  <Card>
                    <h4 className='font-semibold mb-2'>
                      Two-Factor Authentication
                    </h4>
                    <p className='text-gray-600 text-sm mb-3'>
                      {twoFactorEnabled
                        ? 'Two-factor authentication is enabled. You will receive a code via email on login.'
                        : 'Enable two-factor authentication to add an extra layer of security to your account.'}
                    </p>
                    {twoFactorEnabled ? (
                      <>
                        {qrCodeUrl && (
                          <div className='mb-4'>
                            <p className='text-gray-600 text-sm mb-2'>
                              Scan this QR code with your authenticator app to
                              set up 2FA:
                            </p>
                            <img
                              src={qrCodeUrl}
                              alt='2FA QR Code'
                              className='w-48 h-48 mx-auto'
                            />
                          </div>
                        )}
                        <Popconfirm
                          title='Disable two-factor authentication?'
                          description='This will remove 2FA from your account, making it less secure.'
                          onConfirm={handleDisable2FA}
                          okText='Disable'
                          cancelText='Cancel'
                        >
                          <Button
                            type='primary'
                            danger
                            icon={<FiLock />}
                            loading={submitting}
                          >
                            Disable 2FA
                          </Button>
                        </Popconfirm>
                      </>
                    ) : (
                      <Button
                        type='primary'
                        icon={<FiLock />}
                        onClick={handleEnable2FA}
                        loading={submitting}
                      >
                        Enable 2FA
                      </Button>
                    )}
                  </Card>
                </div>
              </div>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

export default AdminSettingsPage;
