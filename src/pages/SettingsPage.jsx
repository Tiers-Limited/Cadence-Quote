import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Segmented,
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  message,
  Spin,
  Modal,
  Select,
  Popconfirm,
  Switch,
  Tabs
} from 'antd'
import '../styles/cards.css'
import {
  FiSave,
  FiSettings,
  FiDollarSign,
  FiFileText,
  FiPackage
} from 'react-icons/fi'
import { apiService } from '../services/apiService'
import MainLayout from '../components/MainLayout'

const { TextArea } = Input
const { TabPane } = Tabs
const { Option } = Select

function SettingsPage () {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('company')

  // Form instances
  const [companyForm] = Form.useForm()
  const [settingsForm] = Form.useForm()

  // Data states
  const [pricingSchemes, setPricingSchemes] = useState([])
  const [pricingSchemeModalVisible, setPricingSchemeModalVisible] =
    useState(false)
  const [editingPricingScheme, setEditingPricingScheme] = useState(null)
  const [pricingSchemeForm] = Form.useForm()

  useEffect(() => {
    fetchAllSettings()
  }, [])

  const fetchAllSettings = async () => {
    setLoading(true)
    try {
      // Fetch contractor settings and company info
      const settingsData = await apiService.get('/settings')
      if (settingsData.success) {
        // Populate forms
        settingsForm.setFieldsValue(settingsData.data.settings)
        companyForm.setFieldsValue(settingsData.data.companyInfo)
      }

      // Fetch pricing schemes
      const schemesData = await apiService.get('/pricing-schemes')
      if (schemesData.success) {
        setPricingSchemes(schemesData.data)
      }
    } catch (error) {
      message.error('Failed to load settings: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCompanyInfo = async values => {
    setSaving(true)
    try {
      const response = await apiService.put('/settings/company', values)
      if (response.success) {
        message.success('Company information updated successfully')
      }
    } catch (error) {
      message.error('Failed to update company info: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSettings = async values => {
    setSaving(true)
    try {
      const response = await apiService.put('/settings', values)
      if (response.success) {
        message.success('Settings updated successfully')
      }
    } catch (error) {
      message.error('Failed to update settings: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefaultScheme = async schemeId => {
    try {
      const response = await apiService.put(
        `/pricing-schemes/${schemeId}/set-default`
      )
      if (response.success) {
        message.success('Default pricing scheme updated')
        // Refresh pricing schemes
        const schemesData = await apiService.get('/pricing-schemes')
        if (schemesData.success) {
          setPricingSchemes(schemesData.data)
        }
      }
    } catch (error) {
      message.error('Failed to set default scheme: ' + error.message)
    }
  }

  const handleCreatePricingScheme = () => {
    setEditingPricingScheme(null)
    pricingSchemeForm.resetFields()
    pricingSchemeForm.setFieldsValue({
      type: 'sqft_turnkey',
      isActive: true,
      pricingRules: [] // form expects an array of rule entries
    })
    setPricingSchemeModalVisible(true)
  }

  const handleEditPricingScheme = scheme => {
    setEditingPricingScheme(scheme)
    // The form uses a Form.List (array) for pricingRules. Convert stored object -> array
    const rulesArray = []
    if (scheme.pricingRules && typeof scheme.pricingRules === 'object') {
      Object.entries(scheme.pricingRules).forEach(([surface, obj]) => {
        rulesArray.push({ surface, price: obj.price, unit: obj.unit })
      })
    } else if (Array.isArray(scheme.pricingRules)) {
      // Already an array
      scheme.pricingRules.forEach(r => rulesArray.push(r))
    }

    pricingSchemeForm.setFieldsValue({
      ...scheme,
      pricingRules: rulesArray
    })
    setPricingSchemeModalVisible(true)
  }

  const handleDeletePricingScheme = async schemeId => {
    try {
      const response = await apiService.delete(`/pricing-schemes/${schemeId}`)
      if (response.success) {
        message.success('Pricing scheme deleted successfully')
        // Refresh pricing schemes
        const schemesData = await apiService.get('/pricing-schemes')
        if (schemesData.success) {
          setPricingSchemes(schemesData.data)
        }
      }
    } catch (error) {
      message.error('Failed to delete pricing scheme: ' + error.message)
    }
  }

  const handlePricingSchemeSubmit = async values => {
    try {
      // Normalize pricingRules: form uses an array, backend expects an object keyed by surface
      const rulesArray = values.pricingRules || []
      const pricingRulesObj = {}
      if (Array.isArray(rulesArray)) {
        rulesArray.forEach(rule => {
          if (!rule) return
          const key = String(rule.surface || '').trim()
          if (!key) return
          pricingRulesObj[key] = {
            price: Number(rule.price) || 0,
            unit: String(rule.unit || '').trim() || 'sqft'
          }
        })
      } else if (values.pricingRules && typeof values.pricingRules === 'object') {
        Object.assign(pricingRulesObj, values.pricingRules)
      }

      const payload = { ...values, pricingRules: pricingRulesObj }

      let response
      if (editingPricingScheme) {
        response = await apiService.put(
          `/pricing-schemes/${editingPricingScheme.id}`,
          payload
        )
        if (response.success) {
          message.success('Pricing scheme updated successfully')
        }
      } else {
        response = await apiService.post('/pricing-schemes', payload)
        if (response.success) {
          message.success('Pricing scheme created successfully')
        }
      }

      setPricingSchemeModalVisible(false)

      // Refresh pricing schemes list
      const schemesData = await apiService.get('/pricing-schemes')
      if (schemesData.success) {
        setPricingSchemes(schemesData.data)
      }
    } catch (error) {
      message.error(
        `Failed to ${editingPricingScheme ? 'update' : 'create'} pricing scheme: ${error.message}`
      )
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Spin size='large' tip='Loading settings...' />
      </div>
    )
  }

  return (
   
      <div className='p-8'>
        <div className='max-w-6xl mx-auto'>
          {/* Header */}
          <div className='mb-6'>
            <div className='flex items-center gap-3 mb-2'>
              <FiSettings className='text-3xl text-blue-600' />
              <h1 className='text-3xl font-bold text-gray-900'>Settings</h1>
            </div>
            <p className='text-gray-600'>
              Manage your company information, pricing defaults, and system
              preferences
            </p>
          </div>

          {/* Tabs (replaced header with AntD Segmented to get pill/rounded UI) */}
          <Card>
            <div className='mb-4'>
              <Segmented
                value={activeTab}
                onChange={val => setActiveTab(val)}
                options={[
                  { label: 'Company', value: 'company' },
                  { label: 'Quotes', value: 'quotes' },
                  { label: 'Pricing Scheme', value: 'pricing' },
                  { label: 'Product Library', value: 'products' },
                  { label: 'Proposal Toggles', value: 'proposal' },
                  { label: 'Notifications', value: 'notifications' },
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
              {/* Company Info Tab */}
              <TabPane
                tab={
                  <span className='flex items-center gap-2'>
                    <FiSettings />
                    Company Info
                  </span>
                }
                key='company'
              >
                <div className='py-4'>
                  <h3 className='text-lg font-semibold mb-4'>
                    Company Information
                  </h3>
                  <Form
                    form={companyForm}
                    layout='vertical'
                    onFinish={handleSaveCompanyInfo}
                    className='max-w-2xl'
                  >
                    <Form.Item
                      label='Company Name'
                      name='companyName'
                      rules={[
                        { required: true, message: 'Please enter company name' }
                      ]}
                    >
                      <Input size='large' placeholder='Your Company Name' />
                    </Form.Item>

                    <Form.Item
                      label='Email'
                      name='email'
                      rules={[
                        { required: true, message: 'Please enter email' },
                        { type: 'email', message: 'Please enter a valid email' }
                      ]}
                    >
                      <Input size='large' placeholder='company@example.com' />
                    </Form.Item>

                    <Form.Item label='Phone' name='phone'>
                      <Input size='large' placeholder='(555) 123-4567' />
                    </Form.Item>

                    <Form.Item label='Business Address' name='businessAddress'>
                      <TextArea
                        rows={3}
                        placeholder='123 Main Street, City, State, ZIP'
                      />
                    </Form.Item>

                    <Form.Item label='Website' name='website'>
                      <Input size='large' placeholder='www.yourcompany.com' />
                    </Form.Item>

                    <Form.Item>
                      <Button
                        type='primary'
                        htmlType='submit'
                        icon={<FiSave />}
                        loading={saving}
                        size='large'
                      >
                        Save Company Info
                      </Button>
                    </Form.Item>
                  </Form>
                </div>
              </TabPane>

              {/* Quote Settings Tab */}
              <TabPane
                tab={
                  <span className='flex items-center gap-2'>
                    <FiDollarSign />
                    Quote Settings
                  </span>
                }
                key='quotes'
              >
                <div className='py-4'>
                  <h3 className='text-lg font-semibold mb-4'>
                    Default Quote Settings
                  </h3>
                  <Form
                    form={settingsForm}
                    layout='vertical'
                    onFinish={handleSaveSettings}
                    className='max-w-2xl'
                  >
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                      <Form.Item
                        label='Default Markup %'
                        name='defaultMarkupPercent'
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber
                          size='large'
                          min={0}
                          max={100}
                          precision={2}
                          style={{ width: '100%' }}
                          formatter={value => `${value}%`}
                          parser={value => value.replace('%', '')}
                        />
                      </Form.Item>

                      <Form.Item
                        label='Default Tax %'
                        name='defaultTaxPercent'
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber
                          size='large'
                          min={0}
                          max={100}
                          precision={2}
                          style={{ width: '100%' }}
                          formatter={value => `${value}%`}
                          parser={value => value.replace('%', '')}
                        />
                      </Form.Item>

                      <Form.Item
                        label='Default Deposit %'
                        name='defaultDepositPercent'
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <InputNumber
                          size='large'
                          min={0}
                          max={100}
                          precision={2}
                          style={{ width: '100%' }}
                          formatter={value => `${value}%`}
                          parser={value => value.replace('%', '')}
                        />
                      </Form.Item>
                    </div>

                    <Form.Item
                      label='Quote Validity (Days)'
                      name='quoteValidityDays'
                    >
                      <InputNumber
                        size='large'
                        min={1}
                        max={365}
                        style={{ width: '200px' }}
                      />
                    </Form.Item>

                    <Form.Item label='Business Hours' name='businessHours'>
                      <Input size='large' placeholder='Mon-Fri 8AM-5PM' />
                    </Form.Item>

                    <Form.Item
                      label='Payment Terms'
                      name='paymentTerms'
                      tooltip='Default payment terms for quotes'
                    >
                      <TextArea
                        rows={3}
                        placeholder='e.g., Net 30, 50% deposit required, balance due upon completion'
                      />
                    </Form.Item>

                    <Form.Item label='Warranty Terms' name='warrantyTerms'>
                      <TextArea
                        rows={3}
                        placeholder='e.g., 1 year workmanship warranty'
                      />
                    </Form.Item>

                    <Form.Item
                      label='General Terms & Conditions'
                      name='generalTerms'
                    >
                      <TextArea
                        rows={4}
                        placeholder='Standard terms and conditions for all quotes'
                      />
                    </Form.Item>

                    <Form.Item>
                      <Button
                        type='primary'
                        htmlType='submit'
                        icon={<FiSave />}
                        loading={saving}
                        size='large'
                      >
                        Save Quote Settings
                      </Button>
                    </Form.Item>
                  </Form>
                </div>
              </TabPane>

              {/* Pricing Scheme Tab */}
              <TabPane
                tab={
                  <span className='flex items-center gap-2'>
                    <FiFileText />
                    Pricing Scheme
                  </span>
                }
                key='pricing'
              >
                <div className='py-4'>
                  <div className='flex items-center justify-between mb-4'>
                    <h3 className='text-lg font-semibold'>Pricing Schemes</h3>
                    <Button type='primary' onClick={handleCreatePricingScheme}>
                      Create New Scheme
                    </Button>
                  </div>

                  {pricingSchemes.length > 0 ? (
                    <div className='space-y-3'>
                      {pricingSchemes.map(scheme => (
                        <Card
                          key={scheme.id}
                          className={`${
                            scheme.isDefault ? 'border-blue-500 border-2' : ''
                          }`}
                        >
                          <div className='flex items-center justify-between'>
                            <div className='flex-1'>
                              <div className='flex items-center gap-2'>
                                <h4 className='font-semibold text-lg'>
                                  {scheme.name}
                                </h4>
                                {scheme.isDefault && (
                                  <span className='bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded'>
                                    Default
                                  </span>
                                )}
                                {!scheme.isActive && (
                                  <span className='bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded'>
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <p className='text-gray-600 text-sm mt-1'>
                                Type:{' '}
                                <span className='font-medium'>
                                  {scheme.type.replace('_', ' ').toUpperCase()}
                                </span>
                              </p>
                              {scheme.description && (
                                <p className='text-gray-500 text-sm mt-1'>
                                  {scheme.description}
                                </p>
                              )}
                              {scheme.pricingRules &&
                                Object.keys(scheme.pricingRules).length > 0 && (
                                  <div className='mt-2'>
                                    <p className='text-xs text-gray-500 mb-1'>
                                      Pricing Rules:
                                    </p>
                                    <div className='flex flex-wrap gap-1'>
                                      {Object.entries(scheme.pricingRules).map(
                                        ([key, value]) => (
                                          <span
                                            key={key}
                                            className='bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded'
                                          >
                                            {key}: ${value.price}/{value.unit}
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                            <div className='flex items-center gap-2'>
                              {!scheme.isDefault && (
                                <Button
                                  type='default'
                                  size='small'
                                  onClick={() =>
                                    handleSetDefaultScheme(scheme.id)
                                  }
                                >
                                  Set Default
                                </Button>
                              )}
                              <Button
                                type='link'
                                size='small'
                                onClick={() => handleEditPricingScheme(scheme)}
                              >
                                Edit
                              </Button>
                              <Popconfirm
                                title='Delete pricing scheme?'
                                description='This action cannot be undone.'
                                onConfirm={() =>
                                  handleDeletePricingScheme(scheme.id)
                                }
                                okText='Delete'
                                cancelText='Cancel'
                              >
                                <Button type='link' size='small' danger>
                                  Delete
                                </Button>
                              </Popconfirm>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className='text-center py-12 text-gray-500'>
                      <FiFileText className='text-5xl mx-auto mb-4 text-gray-300' />
                      <p>No pricing schemes created yet.</p>
                      <Button type='primary' className='mt-4'>
                        Create Your First Scheme
                      </Button>
                    </div>
                  )}
                </div>
              </TabPane>

              {/* Product Library Tab */}
              <TabPane
                tab={
                  <span className='flex items-center gap-2'>
                    <FiPackage />
                    Product Library
                  </span>
                }
                key='products'
              >
                <div className='py-4'>
                  <div className='text-center py-12'>
                    <FiPackage className='text-5xl mx-auto mb-4 text-gray-300' />
                    <h3 className='text-lg font-semibold mb-2'>
                      Product Library
                    </h3>
                    <p className='text-gray-600 mb-4'>
                      Manage your paint products and color library
                    </p>
                    <Button
                      type='primary'
                      size='large'
                      onClick={() => navigate('/products')}
                    >
                      Go to Product Library
                    </Button>
                  </div>
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
                  <h3 className='text-lg font-semibold mb-4'>
                    Account Settings
                  </h3>
                  <div className='max-w-2xl space-y-4'>
                    <Card>
                      <h4 className='font-semibold mb-2'>Password</h4>
                      <p className='text-gray-600 text-sm mb-3'>
                        Change your account password
                      </p>
                      <Button
                        onClick={() =>
                          message.info('Password change - Coming soon')
                        }
                      >
                        Change Password
                      </Button>
                    </Card>

                    <Card>
                      <h4 className='font-semibold mb-2'>Subscription</h4>
                      <p className='text-gray-600 text-sm mb-3'>
                        Manage your subscription and billing
                      </p>
                      <Button
                        onClick={() =>
                          message.info('Subscription management - Coming soon')
                        }
                      >
                        Manage Subscription
                      </Button>
                    </Card>

                    <Card className='border-red-200'>
                      <h4 className='font-semibold text-red-600 mb-2'>
                        Danger Zone
                      </h4>
                      <p className='text-gray-600 text-sm mb-3'>
                        Permanently delete your account and all data
                      </p>
                      <Button
                        danger
                        onClick={() =>
                          message.warning(
                            'Account deletion requires confirmation'
                          )
                        }
                      >
                        Delete Account
                      </Button>
                    </Card>
                  </div>
                </div>
              </TabPane>
            </Tabs>
          </Card>

          {/* Pricing Scheme Modal */}
          <div>
            <Modal
              title={
                editingPricingScheme
                  ? 'Edit Pricing Scheme'
                  : 'Create Pricing Scheme'
              }
              open={pricingSchemeModalVisible}
              onCancel={() => setPricingSchemeModalVisible(false)}
              footer={null}
              width={800}
            >
              <Form
                form={pricingSchemeForm}
                layout='vertical'
                onFinish={handlePricingSchemeSubmit}
                className='mt-4'
              >
                <div className='grid grid-cols-2 gap-4'>
                  <Form.Item
                    label='Scheme Name'
                    name='name'
                    rules={[
                      { required: true, message: 'Please enter scheme name' }
                    ]}
                  >
                    <Input placeholder='e.g., Square-Foot (Turnkey)' />
                  </Form.Item>

                  <Form.Item
                    label='Scheme Type'
                    name='type'
                    rules={[
                      { required: true, message: 'Please select scheme type' }
                    ]}
                  >
                    <Select>
                      <Option value='sqft_turnkey'>
                        Square-Foot (Turnkey)
                      </Option>
                      <Option value='sqft_labor_only'>
                        Square-Foot (Labor Only)
                      </Option>
                      <Option value='hourly_time_materials'>
                        Hourly (Time & Materials)
                      </Option>
                      <Option value='unit_based'>Unit Based</Option>
                    </Select>
                  </Form.Item>
                </div>

                <Form.Item label='Description' name='description'>
                  <Input.TextArea
                    rows={2}
                    placeholder='Optional description of this pricing scheme'
                  />
                </Form.Item>

                <Form.Item
                  label='Active'
                  name='isActive'
                  valuePropName='checked'
                >
                  <Switch />
                </Form.Item>

                <div className='border-t pt-4'>
                  <h4 className='font-semibold mb-3'>Pricing Rules</h4>
                  <p className='text-sm text-gray-600 mb-4'>
                    Define pricing rules for different surfaces and work types.
                    These will be used for automatic quote calculations.
                  </p>

                  <Form.List name='pricingRules'>
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <div
                            key={key}
                            className='flex items-center gap-3 mb-3 p-3 border rounded'
                          >
                            <Form.Item
                              {...restField}
                              name={[name, 'surface']}
                              rules={[
                                { required: true, message: 'Surface required' }
                              ]}
                              className='flex-1'
                            >
                              <Select placeholder='Surface/Work Type'>
                                <Option value='walls'>Interior Walls</Option>
                                <Option value='ceilings'>Ceilings</Option>
                                <Option value='trim'>Trim/Baseboards</Option>
                                <Option value='doors'>Doors</Option>
                                <Option value='windows'>Windows</Option>
                                <Option value='hourly_rate'>Hourly Rate</Option>
                                <Option value='primer'>
                                  Primer Application
                                </Option>
                                <Option value='custom'>Custom Work</Option>
                              </Select>
                            </Form.Item>

                            <Form.Item
                              {...restField}
                              name={[name, 'price']}
                              rules={[
                                { required: true, message: 'Price required' }
                              ]}
                            >
                              <InputNumber
                                placeholder='0.00'
                                min={0}
                                precision={2}
                                style={{ width: 100 }}
                              />
                            </Form.Item>

                            <Form.Item
                              {...restField}
                              name={[name, 'unit']}
                              rules={[
                                { required: true, message: 'Unit required' }
                              ]}
                            >
                              <Select placeholder='Unit' style={{ width: 120 }}>
                                <Option value='sqft'>per sqft</Option>
                                <Option value='linear_ft'>per linear ft</Option>
                                <Option value='hour'>per hour</Option>
                                <Option value='unit'>per unit</Option>
                                <Option value='gallon'>per gallon</Option>
                              </Select>
                            </Form.Item>

                            <Button
                              type='link'
                              danger
                              onClick={() => remove(name)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}

                        <Button type='dashed' onClick={() => add()} block>
                          Add Pricing Rule
                        </Button>
                      </>
                    )}
                  </Form.List>
                </div>

                <div className='flex justify-end gap-3 mt-6'>
                  <Button onClick={() => setPricingSchemeModalVisible(false)}>
                    Cancel
                  </Button>
                  <Button type='primary' htmlType='submit'>
                    {editingPricingScheme ? 'Update Scheme' : 'Create Scheme'}
                  </Button>
                </div>
              </Form>
            </Modal>
          </div>
        </div>
      </div>
  
  )
}

export default SettingsPage
