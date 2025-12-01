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
  Tabs,
  Radio,
  Badge
} from 'antd'
import '../styles/cards.css'
import {
  FiSave,
  FiSettings,
  FiDollarSign,
  FiFileText,
  FiPackage,
  FiLock,
  FiCheck
} from 'react-icons/fi'
import { apiService } from '../services/apiService'

const { TextArea } = Input
const { TabPane } = Tabs
const { Option } = Select

function SettingsPage () {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('company')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState(null)
  const [defaultPricingScheme, setDefaultPricingScheme] = useState('sqft_turnkey')

  // Form instances
  const [companyForm] = Form.useForm()
  const [settingsForm] = Form.useForm()
  const [pricingSchemeForm] = Form.useForm()

  // Data states
  const [pricingSchemes, setPricingSchemes] = useState([])
  const [pricingSchemeModalVisible, setPricingSchemeModalVisible] =
    useState(false)
  const [editingPricingScheme, setEditingPricingScheme] = useState(null)
  const [selectedPricingType, setSelectedPricingType] = useState(null)

  const pricingSchemeOptions = [
    {
      id: 'sqft_turnkey',
      title: 'Square-Foot (Turnkey)',
      description: 'All-in $/sqft price (labor + paint included).',
      example: '1,200 sqft × $1.15 = $1,380',
      bestFor: 'Fast quoting on full rooms, houses, or projects where customers want one simple number.',
      formula: 'Total Paintable Sqft × Price per Sqft'
    },
    {
      id: 'sqft_labor_paint',
      title: 'Square-Foot (Labor + Paint Separated)',
      description: 'Labor charged per sqft, paint priced separately by gallons.',
      example: '1,200 sqft × $0.55 = $660 + paint cost',
      bestFor: 'Clients who want transparency between labor and materials, or when upselling paint quality tiers.',
      formula: '(Sqft × Labor Rate) + (Gallons × Paint Price)'
    },
    {
      id: 'hourly_time_materials',
      title: 'Hourly (Time & Materials)',
      description: 'Crew hours × hourly rate, plus actual materials.',
      example: '3 painters × 40 hrs × $50/hr = $6,000 + paint',
      bestFor: 'Small jobs, repair-heavy projects, or when scope and time are uncertain.',
      formula: '(Crew Size × Hours × Rate) + Paint Cost'
    },
    {
      id: 'unit_pricing',
      title: 'Unit / Assembly Pricing',
      description: 'Price per unit (doors, windows, trim LF, cabinets, fences, decks).',
      example: '10 doors × $45 = $450',
      bestFor: 'Projects with measurable pieces (doors, cabinets, trim), where counting units gives clarity.',
      formula: 'Σ(Quantity × Unit Price)'
    },
    {
      id: 'room_flat_rate',
      title: 'Room / Area Flat Rate',
      description: 'Standard price per room or area from a catalog.',
      example: 'Bedroom = $325',
      bestFor: 'Quick bids on common areas (bedrooms, kitchens, baths), where flat pricing speeds up quoting.',
      formula: 'Σ(Room Type × Flat Rate)'
    }
  ]

  useEffect(() => {
    fetchAllSettings()
  }, [])

  const fetchAllSettings = async () => {
    setLoading(true)
    try {
      // Fetch contractor settings and company info
      const settingsData = await apiService.get('/settings')
      if (settingsData.success) {
        const { data } = settingsData

        // Populate settings form (quote settings)
        settingsForm.setFieldsValue({
          defaultMarkupPercent: data.defaultMarkupPercentage,
          defaultTaxPercent: data.taxRatePercentage,
          defaultDepositPercent: data.depositPercentage,
          paymentTerms: data.paymentTerms,
          warrantyTerms: data.warrantyTerms,
          generalTerms: data.generalTerms,
          businessHours: data.businessHours,
          quoteValidityDays: data.quoteValidityDays
        })

        // Populate company form
        if (data.tenant) {
          companyForm.setFieldsValue({
            companyName: data.tenant.companyName,
            email: data.tenant.email,
            phone: data.tenant.phoneNumber,
            businessAddress: data.tenant.businessAddress,
            tradeType: data.tenant.tradeType
          })
        }
      }

      // Fetch pricing schemes
      const schemesData = await apiService.get('/pricing-schemes')
      if (schemesData.success) {
        setPricingSchemes(schemesData.data)
        // Find and set the default pricing scheme
        const defaultScheme = schemesData.data.find(s => s.isDefault)
        if (defaultScheme) {
          setDefaultPricingScheme(defaultScheme.type)
        }
      }

      // Fetch 2FA status
      const twoFactorData = await apiService.get('/auth/2fa-status')
      if (twoFactorData.success) {
        setTwoFactorEnabled(twoFactorData.data.twoFactorEnabled || false)
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
      const payload = {
        companyName: values.companyName,
        email: values.email,
        phoneNumber: values.phone,
        businessAddress: values.businessAddress,
        tradeType: values.tradeType
      }

      const response = await apiService.put('/settings/company', payload)
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
      const payload = {
        defaultMarkupPercentage: values.defaultMarkupPercent,
        taxRatePercentage: values.defaultTaxPercent,
        depositPercentage: values.defaultDepositPercent,
        paymentTerms: values.paymentTerms,
        warrantyTerms: values.warrantyTerms,
        generalTerms: values.generalTerms,
        businessHours: values.businessHours,
        quoteValidityDays: values.quoteValidityDays
      }

      const response = await apiService.put('/settings', payload)
      if (response.success) {
        message.success('Settings updated successfully')
      }
    } catch (error) {
      message.error('Failed to update settings: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSavePricingScheme = async () => {
    setSaving(true)
    try {
      // Find the existing scheme with this type or create new one
      const existingScheme = pricingSchemes.find(s => s.type === defaultPricingScheme)
      
      if (existingScheme) {
        // Set as default
        const response = await apiService.put(`/pricing-schemes/${existingScheme.id}/set-default`)
        if (response.success) {
          message.success('Default pricing scheme updated successfully')
          fetchAllSettings()
        }
      } else {
        // Create new scheme with this type
        const schemeData = pricingSchemeOptions.find(s => s.id === defaultPricingScheme)
        const payload = {
          name: schemeData.title,
          type: defaultPricingScheme,
          description: schemeData.description,
          isActive: true,
          isDefault: true,
          pricingRules: {}
        }
        
        const response = await apiService.post('/pricing-schemes', payload)
        if (response.success) {
          message.success('Pricing scheme created and set as default')
          fetchAllSettings()
        }
      }
    } catch (error) {
      message.error('Failed to update pricing scheme: ' + error.message)
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
    setSelectedPricingType(null)
    pricingSchemeForm.resetFields()
    pricingSchemeForm.setFieldsValue({
      type: '',
      isActive: true,
      pricingRules: []
    })
    setPricingSchemeModalVisible(true)
  }

  const getPricingRuleOptions = pricingType => {
    const options = {
      sqft_turnkey: [
        { value: 'walls', label: 'Interior Walls ($/sqft)' },
        { value: 'ceilings', label: 'Ceilings ($/sqft)' },
        { value: 'exterior_walls', label: 'Exterior Walls ($/sqft)' }
      ],
      sqft_labor_paint: [
        { value: 'labor_rate', label: 'Labor Rate ($/sqft)' },
        { value: 'paint', label: 'Paint Cost ($/gallon)' },
        { value: 'coverage', label: 'Paint Coverage (sqft/gallon)' }
      ],
      hourly_time_materials: [
        { value: 'hourly_rate', label: 'Hourly Rate ($/hour per painter)' },
        { value: 'crew_size', label: 'Default Crew Size (# painters)' },
        { value: 'paint', label: 'Paint Cost ($/gallon)' }
      ],
      unit_pricing: [
        { value: 'door', label: 'Door ($/each)' },
        { value: 'window', label: 'Window ($/each)' },
        { value: 'trim', label: 'Trim ($/linear ft)' },
        { value: 'shutter', label: 'Shutter ($/each)' },
        { value: 'cabinet_door', label: 'Cabinet Door ($/each)' },
        { value: 'garage_door', label: 'Garage Door ($/each)' }
      ],
      room_flat_rate: [
        { value: 'small_bedroom', label: 'Small Bedroom (10x12x8)' },
        { value: 'medium_bedroom', label: 'Medium Bedroom (12x14x8)' },
        { value: 'large_bedroom', label: 'Large Bedroom (14x16x8)' },
        { value: 'small_living', label: 'Small Living Room (12x15x8)' },
        { value: 'medium_living', label: 'Medium Living Room (15x20x8)' },
        { value: 'large_living', label: 'Large Living Room (20x25x9)' },
        { value: 'bathroom', label: 'Bathroom (5x8x8)' },
        { value: 'kitchen', label: 'Kitchen (12x15x8)' }
      ]
    }
    return options[pricingType] || []
  }

  const handleEditPricingScheme = scheme => {
    setEditingPricingScheme(scheme)
    setSelectedPricingType(scheme.type)
    const rulesArray = []
    if (scheme.pricingRules && typeof scheme.pricingRules === 'object') {
      Object.entries(scheme.pricingRules).forEach(([surface, obj]) => {
        rulesArray.push({ surface, price: obj.price, unit: obj.unit })
      })
    } else if (Array.isArray(scheme.pricingRules)) {
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
      } else if (
        values.pricingRules &&
        typeof values.pricingRules === 'object'
      ) {
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
      const schemesData = await apiService.get('/pricing-schemes')
      if (schemesData.success) {
        setPricingSchemes(schemesData.data)
      }
    } catch (error) {
      message.error(
        `Failed to ${
          editingPricingScheme ? 'update' : 'create'
        } pricing scheme: ${error.message}`
      )
    }
  }

  const handleEnable2FA = async () => {
    setSaving(true)
    try {
      const response = await apiService.post('/auth/enable-2fa', {})
      if (response.success) {
        setTwoFactorEnabled(true)
        setQrCodeUrl(response.data.qrCodeUrl)
        message.success(
          'Two-factor authentication enabled. Scan the QR code with your authenticator app.'
        )
      }
    } catch (error) {
      message.error('Failed to enable 2FA: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDisable2FA = async () => {
    setSaving(true)
    try {
      const response = await apiService.post('/auth/disable-2fa')
      if (response.success) {
        setTwoFactorEnabled(false)
        setQrCodeUrl(null)
        message.success('Two-factor authentication disabled.')
      }
    } catch (error) {
      message.error('Failed to disable 2FA: ' + error.message)
    } finally {
      setSaving(false)
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
    <div className=''>
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

        {/* Tabs */}
        <Card>
          <div className='mb-4'>
            <Segmented
              value={activeTab}
              onChange={val => setActiveTab(val)}
              options={[
                { label: 'Company', value: 'company' },
                { label: 'Quotes', value: 'quotes' },
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

                  <Form.Item
                    label='Trade Type'
                    name='tradeType'
                    rules={[
                      { required: true, message: 'Please select a trade type' }
                    ]}
                  >
                    <Select size='large' placeholder='Select your trade type'>
                      <Option value='painter'>Painter</Option>
                      <Option value='drywall'>Drywall</Option>
                      <Option value='pressure_washing'>Pressure Washing</Option>
                      <Option value='plumbing'>Plumbing</Option>
                      <Option value='electrical'>Electrical</Option>
                      <Option value='hvac'>HVAC</Option>
                      <Option value='roofing'>Roofing</Option>
                      <Option value='landscaping'>Landscaping</Option>
                      <Option value='other'>Other</Option>
                    </Select>
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

                {/* Pricing Scheme Section */}
                <div className='mt-8 pt-8 border-t'>
                  <h3 className='text-lg font-semibold mb-2'>
                    <FiDollarSign className='inline mr-2' />
                    Pricing Scheme Settings
                  </h3>
                  <p className='text-sm text-gray-600 mb-6'>
                    Choose your default pricing method. This will auto-fill in new quotes. Contractors can still override per quote.
                  </p>

                  <Radio.Group 
                    value={defaultPricingScheme} 
                    onChange={(e) => setDefaultPricingScheme(e.target.value)}
                    className='w-full'
                  >
                    <div className='space-y-4'>
                      {pricingSchemeOptions.map((scheme) => (
                        <div key={scheme.id}>
                          <Radio value={scheme.id} className='hidden' id={`radio-${scheme.id}`} />
                          <label htmlFor={`radio-${scheme.id}`} className='cursor-pointer'>
                            <Card 
                              className={`p-6 transition-all duration-200 hover:shadow-md ${
                                defaultPricingScheme === scheme.id 
                                  ? 'border-blue-500 border-2 bg-blue-50/50 shadow-md' 
                                  : 'border-gray-200 hover:border-blue-300'
                              }`}
                              onClick={() => setDefaultPricingScheme(scheme.id)}
                            >
                              <div className='flex items-start gap-4'>
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${
                                  defaultPricingScheme === scheme.id
                                    ? 'border-blue-500 bg-blue-500'
                                    : 'border-gray-300'
                                }`}>
                                  {defaultPricingScheme === scheme.id && (
                                    <FiCheck className='text-white text-sm' />
                                  )}
                                </div>
                                
                                <div className='flex-1 space-y-3'>
                                  <div className='flex items-center gap-3'>
                                    <h4 className='font-semibold text-base text-gray-900'>
                                      {scheme.title}
                                    </h4>
                                    {defaultPricingScheme === scheme.id && (
                                      <Badge 
                                        count="Default" 
                                        style={{ backgroundColor: '#1890ff' }}
                                      />
                                    )}
                                  </div>
                                  
                                  <p className='text-sm text-gray-700 leading-relaxed'>
                                    {scheme.description}
                                  </p>
                                  
                                  <div className='bg-amber-50 border border-amber-200 p-3 rounded-lg'>
                                    <p className='text-sm font-mono text-gray-800'>
                                      <span className='font-semibold text-amber-800'>Example: </span>
                                      {scheme.example}
                                    </p>
                                  </div>
                                  
                                  <div className='bg-blue-50 border border-blue-200 p-3 rounded-lg'>
                                    <p className='text-sm text-blue-900'>
                                      <span className='font-semibold'>Formula: </span>
                                      {scheme.formula}
                                    </p>
                                  </div>
                                  
                                  <p className='text-xs text-gray-600 italic'>
                                    <span className='font-semibold'>Best for: </span>
                                    {scheme.bestFor}
                                  </p>
                                </div>
                              </div>
                            </Card>
                          </label>
                        </div>
                      ))}
                    </div>
                  </Radio.Group>

                  <div className='mt-6'>
                    <Button
                      type='primary'
                      icon={<FiSave />}
                      loading={saving}
                      size='large'
                      onClick={handleSavePricingScheme}
                    >
                      Save Pricing Scheme
                    </Button>
                  </div>
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
                <h3 className='text-lg font-semibold mb-4'>Account Settings</h3>
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
                            loading={saving}
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
                        loading={saving}
                      >
                        Enable 2FA
                      </Button>
                    )}
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
      </div>
    </div>
  )
}

export default SettingsPage
