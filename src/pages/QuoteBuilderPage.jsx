import { useState, useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Card, Steps, message, Progress, Button } from 'antd';
import {
  UserOutlined,
  HomeOutlined,
  UnorderedListOutlined,
  BgColorsOutlined,
  FileTextOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import CustomerInfoStep from '../components/QuoteBuilder/CustomerInfoStep';
import JobTypeStep from '../components/QuoteBuilder/JobTypeStep';
import AreasStepEnhanced from '../components/QuoteBuilder/AreasStepEnhanced';
import ExteriorAreasStep from '../components/QuoteBuilder/ExteriorAreasStep';
import HomeSizeStep from '../components/QuoteBuilder/HomeSizeStep';
import ProductsStep from '../components/QuoteBuilder/ProductsStep';
import SummaryStep from '../components/QuoteBuilder/SummaryStep';
import { quoteBuilderApi } from '../services/quoteBuilderApi';
import { apiService } from '../services/apiService';

const steps = [
  { id: 0, title: 'Customer Info', icon: UserOutlined },
  { id: 1, title: 'Job Type', icon: HomeOutlined },
  { id: 2, title: 'Areas', icon: UnorderedListOutlined },
  { id: 3, title: 'Products', icon: BgColorsOutlined },
  { id: 4, title: 'Summary', icon: FileTextOutlined }
];

function QuoteBuilderPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const quoteIdFromUrl = searchParams.get('id');
  const editQuote = location.state?.editQuote;
  const isEditMode = !!editQuote || !!quoteIdFromUrl;
  const [loadingQuote, setLoadingQuote] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    // Customer Info (Step 1)
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    pricingSchemeId: null,
    
    // Job Type (Step 2)
    jobType: 'interior',
    
    // Turnkey-specific fields
    homeSqft: null,
    jobScope: 'both', // interior/exterior/both
    numberOfStories: 1,
    conditionModifier: 'average',
    
    // Material calculation controls (global for all models)
    includeMaterials: true,
    coverage: 350,
    applicationMethod: 'roll',
    coats: 2,
    selectedTier: 'better', // GBB tier selection
    
    // Production-Based specific
    hourlyLaborRate: null,
    crewSize: 2,
    productivityRate: null,
    
    // Areas (Step 3) - for non-turnkey models
    areas: [],
    
    // Products (Step 4)
    productStrategy: 'GBB',
    allowCustomerProductChoice: false,
    productSets: [],
    
    // Summary (Step 5)
    notes: '',
    
    // Pricing defaults from settings
    defaultMarkup: 30,
    defaultTax: 8.25,
    defaultDeposit: 50,
    
    // Internal
    quoteId: null,
    clientId: null,
    status: 'draft'
  });

  const [pricingSchemes, setPricingSchemes] = useState([]);
  const [detectedClient, setDetectedClient] = useState(null);
  const [loadingSchemes, setLoadingSchemes] = useState(true);
  const [contractorSettings, setContractorSettings] = useState({});

  const autoSaveInterval = useRef(null);
  const lastSaveTime = useRef(Date.now());

  // Auto-save every 30 seconds
  // useEffect(() => {
  //   autoSaveInterval.current = setInterval(() => {
  //     handleAutoSave();
  //   }, 30000); // 30 seconds

  //   return () => {
  //     if (autoSaveInterval.current) {
  //       clearInterval(autoSaveInterval.current);
  //     }
  //   };
  // }, [formData]);

  // Fetch pricing schemes and load quote data on mount
  useEffect(() => {
    const initializePage = async () => {
      await fetchPricingSchemes();
      
      if (quoteIdFromUrl) {
        // Fetch quote from API using ID from URL
        await fetchQuoteById(quoteIdFromUrl);
      } else if (editQuote) {
        // Load quote data from location state
        loadQuoteForEdit(editQuote);
      } else {
        // Check for existing draft only if not in edit mode
        checkForExistingDraft();
      }
    };
    
    initializePage();
  }, []);

  // Watch for pricing scheme changes and warn user if switching models
  useEffect(() => {
    if (!formData.pricingSchemeId || pricingSchemes.length === 0) return;
    
    const selectedScheme = pricingSchemes.find(s => s.id === formData.pricingSchemeId);
    if (!selectedScheme) return;
    
    const isTurnkey = selectedScheme.type === 'turnkey' || selectedScheme.type === 'sqft_turnkey';
    const hasAreas = formData.areas && formData.areas.length > 0;
    const hasHomeSqft = formData.homeSqft && formData.homeSqft > 0;
    
    // If switching from non-turnkey to turnkey and has areas data
    if (isTurnkey && hasAreas && !hasHomeSqft) {
      message.warning({
        content: 'Switched to Turnkey pricing. Room measurements and products are not needed. They have been cleared.',
        duration: 5
      });
      
      // Clear areas and productSets since turnkey doesn't use them
      setFormData(prev => ({
        ...prev,
        areas: [],
        productSets: [],
        homeSqft: prev.homeSqft || null,
        jobScope: prev.jobScope || 'both',
        numberOfStories: prev.numberOfStories || 1,
        conditionModifier: prev.conditionModifier || 'average'
      }));
    }
    
    // If switching from turnkey to non-turnkey and has home sqft
    if (!isTurnkey && hasHomeSqft && !hasAreas) {
      message.warning({
        content: 'Switched from Turnkey pricing. You will need to add room measurements.',
        duration: 5
      });
      
      // Clear turnkey-specific fields AND productSets to force rebuild
      setFormData(prev => ({
        ...prev,
        homeSqft: null,
        jobScope: 'both',
        numberOfStories: 1,
        conditionModifier: 'average',
        productSets: [] // Force rebuild based on new areas
      }));
    }
    
    // If switching between non-turnkey types, clear productSets to force sync
    // This handles switching from flat rate to sqft-based, etc.
    if (!isTurnkey && hasAreas && formData.productSets && formData.productSets.length > 0) {
      // Check if we need to rebuild productSets based on scheme type change
      const prevSchemeId = formData._lastPricingSchemeId;
      if (prevSchemeId && prevSchemeId !== formData.pricingSchemeId) {
        message.info({
          content: 'Pricing scheme changed. Product selections will be updated.',
          duration: 3
        });
        
        setFormData(prev => ({
          ...prev,
          productSets: [], // Force rebuild
          _lastPricingSchemeId: formData.pricingSchemeId
        }));
      }
    }
  }, [formData.pricingSchemeId, pricingSchemes]);

  // Watch for job type changes and clear areas to prevent showing wrong surface types
  useEffect(() => {
    // Skip on initial mount and when loading draft/edit
    if (!formData.jobType) return;
    
    // Only clear if we have areas from a different job type
    const hasAreas = formData.areas && formData.areas.length > 0;
    if (hasAreas) {
      // Check if areas match current job type by looking at surface categories
      const firstArea = formData.areas[0];
      const firstItem = firstArea?.items?.[0] || firstArea?.laborItems?.[0];
      const categoryName = firstItem?.categoryName?.toLowerCase() || '';
      
      // Interior categories: walls, ceilings, trim, doors, cabinets
      // Exterior categories: siding, fascia, soffit, gutters, deck
      const isInteriorCategory = categoryName.includes('wall') || 
                                 categoryName.includes('ceiling') || 
                                 categoryName.includes('trim') || 
                                 categoryName.includes('door') || 
                                 categoryName.includes('cabinet');
      
      const isExteriorCategory = categoryName.includes('siding') || 
                                 categoryName.includes('fascia') || 
                                 categoryName.includes('soffit') || 
                                 categoryName.includes('gutter') || 
                                 categoryName.includes('deck');
      
      // If job type doesn't match area categories, clear them
      const shouldClearAreas = 
        (formData.jobType === 'interior' && isExteriorCategory) ||
        (formData.jobType === 'exterior' && isInteriorCategory);
      
      if (shouldClearAreas) {
        message.info({
          content: `Job type changed to ${formData.jobType}. Previous areas have been cleared.`,
          duration: 4
        });
        
        setFormData(prev => ({
          ...prev,
          areas: [],
          productSets: []
        }));
      }
    }
  }, [formData.jobType]);

  const fetchPricingSchemes = async () => {
    try {
      setLoadingSchemes(true);
      
      // Fetch pricing schemes
      const response = await apiService.getPricingSchemes();
      let selectedScheme = null;
      
      if (response.success) {
        const schemes = response.data || [];
        setPricingSchemes(schemes);
        
        // Find default scheme
        const defaultScheme = schemes.find(s => s.isDefault);
        
        // Auto-select default pricing scheme if none is selected and not in edit mode
        if (!formData.pricingSchemeId) {
          const schemeToSelect = defaultScheme || (schemes.length > 0 ? schemes[0] : null);
          if (schemeToSelect) {
            setFormData(prev => ({
              ...prev,
              pricingSchemeId: schemeToSelect.id
            }));
            selectedScheme = schemeToSelect;
          }
        } else {
          // Find the already selected scheme
          selectedScheme = schemes.find(s => s.id === formData.pricingSchemeId);
        }
      }
      
      // Fetch contractor settings for defaults (markup, tax, material settings, production settings)
      const settingsResponse = await apiService.get('/settings');
      if (settingsResponse.success && settingsResponse.data) {
        const settings = settingsResponse.data;
        
        // Fetch pricing engine defaults (material settings, crew size, hourly rate)
        const defaultsResponse = await apiService.getProductConfigDefaults();
        const defaults = defaultsResponse?.data || {};
        
        // Determine if we need labor categories and rates based on pricing scheme type
        const schemeType = selectedScheme?.type;
        const needsLaborData = schemeType && 
          (schemeType === 'rate_based_sqft' || 
           schemeType === 'sqft_labor_paint' ||
           schemeType === 'production_based' || 
           schemeType === 'hourly_time_materials');
        
        // Conditionally fetch labor categories and rates only when needed
        let laborCategoriesRes = { success: true, data: [] };
        let laborRatesRes = { success: true, data: [] };
        
        if (needsLaborData) {
          [laborCategoriesRes, laborRatesRes] = await Promise.all([
            apiService.get('/labor-categories'),
            apiService.get('/labor-categories/rates')
          ]);
        }
        
        // Build contractor settings object for child components
        const fullSettings = {
          markups: {
            labor: defaults.laborMarkupPercent || 0,
            material: defaults.materialMarkupPercent || 0,
            overhead: defaults.overheadPercent || 0,
            netProfit: defaults.netProfitPercent || 0
          },
          turnkey: {
            interior: defaults.turnkeyInteriorRate || 0,
            exterior: defaults.turnkeyExteriorRate || 0
          },
          productionRates: {
            interiorWalls: defaults.productionInteriorWalls || 300,
            interiorCeilings: defaults.productionInteriorCeilings || 250,
            interiorTrim: defaults.productionInteriorTrim || 150,
            exteriorWalls: defaults.productionExteriorWalls || 250,
            exteriorTrim: defaults.productionExteriorTrim || 120,
            soffitFascia: defaults.productionSoffitFascia || 100,
            doors: defaults.productionDoors || 2,
            cabinets: defaults.productionCabinets || 1.5
          },
          laborCategories: laborCategoriesRes.success ? laborCategoriesRes.data : [],
          laborRates: laborRatesRes.success ? laborRatesRes.data : [],
          flatRateUnitPrices: defaults.flatRateUnitPrices || {},
          other: {
            taxRate: settings.taxRatePercentage || 8.25,
            depositPercentage: settings.depositPercentage || 50,
            includeMaterials: defaults.includeMaterials !== undefined ? defaults.includeMaterials : true,
            coverage: defaults.coverage || 350,
            applicationMethod: defaults.applicationMethod || 'roll',
            coats: defaults.coats || 2,
            defaultLaborHourRate: defaults.defaultLaborHourRate || 50,
            crewSize: defaults.crewSize || 2,
            quoteValidityDays: defaults.quoteValidityDays || 30
          }
        };
        
        setContractorSettings(fullSettings);
        
        // Store all settings in formData if not already set
        setFormData(prev => ({
          ...prev,
          // Pricing settings
          defaultMarkup: prev.defaultMarkup ?? settings.defaultMarkupPercentage ?? 30,
          defaultTax: prev.defaultTax ?? settings.taxRatePercentage ?? 8.25,
          defaultDeposit: prev.defaultDeposit ?? settings.depositPercentage ?? 50,
          
          // Material settings (from Pricing Engine)
          includeMaterials: prev.includeMaterials ?? fullSettings.other.includeMaterials,
          coverage: prev.coverage ?? fullSettings.other.coverage,
          applicationMethod: prev.applicationMethod ?? fullSettings.other.applicationMethod,
          coats: prev.coats ?? fullSettings.other.coats,
          
          // Production-based settings (from Pricing Engine)
          hourlyLaborRate: prev.hourlyLaborRate ?? fullSettings.other.defaultLaborHourRate,
          crewSize: prev.crewSize ?? fullSettings.other.crewSize,
          productivityRate: prev.productivityRate ?? fullSettings.productionRates.interiorWalls,
          
          // Turnkey rates
          turnkeyInteriorRate: fullSettings.turnkey.interior,
          turnkeyExteriorRate: fullSettings.turnkey.exterior,
          
          // Store full settings for child components
          contractorSettings: fullSettings
        }));
      }
    } catch (error) {
      console.error('Error fetching pricing schemes:', error);
      message.error('Failed to load pricing schemes and settings');
    } finally {
      setLoadingSchemes(false);
    }
  };

  const fetchQuoteById = async (quoteId) => {
    try {
      setLoadingQuote(true);
      const response = await apiService.get(`/quote-builder/quotes/${quoteId}`);
      if (response.success && response.data) {
        loadQuoteForEdit(response.data);
      } else {
        message.error('Failed to load quote');
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
      message.error('Failed to load quote for editing');
    } finally {
      setLoadingQuote(false);
    }
  };

  const loadQuoteForEdit = (quote) => {
    try {
      // Check if the quote uses turnkey pricing
      const quoteScheme = pricingSchemes.find(s => s.id === quote.pricingSchemeId);
      const isTurnkeyQuote = quoteScheme && (quoteScheme.type === 'turnkey' || quoteScheme.type === 'sqft_turnkey');
      
      const baseData = {
        // Customer Info
        customerName: quote.customerName || '',
        customerEmail: quote.customerEmail || '',
        customerPhone: quote.customerPhone || '',
        street: quote.street || '',
        city: quote.city || '',
        state: quote.state || '',
        zipCode: quote.zipCode || '',
        pricingSchemeId: quote.pricingSchemeId || null,
        
        // Job Type
        jobType: quote.jobType || 'interior',
        
        // Turnkey-specific fields (only load if turnkey)
        homeSqft: isTurnkeyQuote ? (quote.homeSqft || null) : null,
        jobScope: isTurnkeyQuote ? (quote.jobScope || 'both') : 'both',
        numberOfStories: isTurnkeyQuote ? (quote.numberOfStories || 1) : 1,
        conditionModifier: isTurnkeyQuote ? (quote.conditionModifier || 'average') : 'average',
        
        // Material settings (preserve if exists, otherwise use current defaults)
        includeMaterials: quote.includeMaterials ?? formData.includeMaterials,
        coverage: quote.coverage || formData.coverage,
        applicationMethod: quote.applicationMethod || formData.applicationMethod,
        coats: quote.coats || formData.coats,
        selectedTier: quote.selectedTier || formData.selectedTier,
        
        // Production-based settings (preserve if exists)
        hourlyLaborRate: quote.hourlyLaborRate || formData.hourlyLaborRate,
        crewSize: quote.crewSize || formData.crewSize,
        productivityRate: quote.productivityRate || formData.productivityRate,
        
        // Areas - only load if NOT turnkey
        areas: isTurnkeyQuote ? [] : (quote.areas || []),
        
        // Products
        productStrategy: quote.productStrategy || 'GBB',
        allowCustomerProductChoice: quote.allowCustomerProductChoice || false,
        productSets: isTurnkeyQuote ? [] : (quote.productSets || []),
        
        // Summary
        notes: quote.notes || '',
        
        // Internal
        quoteId: quote.id,
        clientId: quote.clientId || null,
        status: quote.status || 'draft'
      };
      
      setFormData(baseData);
      
      message.success('Quote loaded for editing');
    } catch (error) {
      console.error('Error loading quote for edit:', error);
      message.error('Failed to load quote data');
    }
  };

  const checkForExistingDraft = async () => {
    try {
      const response = await quoteBuilderApi.getDrafts();
      console.log("Response",response)
      const drafts = response.drafts || [];
      
      if (drafts.length > 0) {
        // Show modal asking if user wants to continue the draft
        const latestDraft = drafts[0];
        message.info({
          content: `Found draft quote from ${new Date(latestDraft.updatedAt).toLocaleDateString()}. Loading...`,
          duration: 3
        });
        
        // Load the draft
        loadDraft(latestDraft.id);
      }
    } catch (error) {
      console.error('Error checking for drafts:', error);
    }
  };

  const loadDraft = async (quoteId) => {
    try {
      const response = await quoteBuilderApi.getQuoteById(quoteId);
      const draft = response.quote;
      
      // Check if the draft uses turnkey pricing
      const draftScheme = pricingSchemes.find(s => s.id === draft.pricingSchemeId);
      const isTurnkeyDraft = draftScheme && (draftScheme.type === 'turnkey' || draftScheme.type === 'sqft_turnkey');
      
      // If it's a turnkey draft, don't load areas/productSets
      // If it's a non-turnkey draft, don't load turnkey-specific fields
      const draftData = {
        ...formData,
        ...draft,
        quoteId: draft.id,
        // Preserve material settings
        includeMaterials: draft.includeMaterials ?? formData.includeMaterials,
        coverage: draft.coverage || formData.coverage,
        applicationMethod: draft.applicationMethod || formData.applicationMethod,
        coats: draft.coats || formData.coats,
        selectedTier: draft.selectedTier || formData.selectedTier,
        // Preserve production settings
        hourlyLaborRate: draft.hourlyLaborRate || formData.hourlyLaborRate,
        crewSize: draft.crewSize || formData.crewSize,
        productivityRate: draft.productivityRate || formData.productivityRate
      };
      
      if (isTurnkeyDraft) {
        // Clear areas and productSets for turnkey
        draftData.areas = [];
        draftData.productSets = [];
      } else {
        // Clear turnkey-specific fields for non-turnkey
        draftData.homeSqft = null;
        draftData.jobScope = 'both';
        draftData.numberOfStories = 1;
        draftData.conditionModifier = 'average';
      }
      
      setFormData(draftData);
      
      message.success('Draft loaded successfully');
    } catch (error) {
      console.error('Error loading draft:', error);
      message.error('Failed to load draft');
    }
  };

  const handleAutoSave = async () => {
    // Only auto-save if there's meaningful data
    const hasData = formData.customerName || formData.customerEmail || formData.areas.length > 0;
    
    if (!hasData) return;

    try {
      const response = await quoteBuilderApi.saveDraft(formData);
      
      if (!formData.quoteId && response.data?.id) {
        setFormData(prev => ({ ...prev, quoteId: response.data.id }));
      }
      
      lastSaveTime.current = Date.now();
      console.log('Auto-saved successfully');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const handleStepDataUpdate = (stepData) => {
    // Special handling for pricing scheme changes
    if (stepData.pricingSchemeId && stepData.pricingSchemeId !== formData.pricingSchemeId) {
      const oldScheme = getCurrentPricingScheme();
      const newScheme = pricingSchemes.find(s => s.id === stepData.pricingSchemeId);
      
      if (oldScheme && newScheme) {
        const oldType = oldScheme.type?.toLowerCase() || '';
        const newType = newScheme.type?.toLowerCase() || '';
        const oldIsTurnkey = oldType.includes('turnkey');
        const newIsTurnkey = newType.includes('turnkey');
        
        // Switching between Turnkey and non-Turnkey
        if (oldIsTurnkey !== newIsTurnkey) {
          const hasData = (formData.areas?.length > 0) || (formData.homeSqft > 0);
          
          if (hasData) {
            Modal.confirm({
              title: 'Change Pricing Model?',
              content: newIsTurnkey 
                ? 'Switching to Turnkey will clear detailed area measurements. Continue?'
                : 'Switching from Turnkey requires detailed room measurements. Continue?',
              okText: 'Yes, Switch',
              cancelText: 'Cancel',
              onOk: () => {
                setFormData(prev => ({
                  ...prev,
                  ...stepData,
                  ...(newIsTurnkey ? { areas: [], productSets: [] } : { homeSqft: null })
                }));
                message.success(`Switched to ${getPricingModelFriendlyName()}`);
              }
            });
            return;
          }
        }
      }
    }

    setFormData(prev => ({
      ...prev,
      ...stepData
    }));
  };

  const handleNext = () => {
    // Customer info validation
    if (currentStep === 0) {
      if (!formData.customerName || !formData.customerEmail) {
        message.warning('Please fill in customer name and email');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.customerEmail)) {
        message.warning('Please enter a valid email address');
        return;
      }
    }

    // Model-specific validation
    if (currentStep >= 1) {
      const validation = validateStepData(currentStep);
      if (!validation.valid) {
        message.warning(validation.message);
        return;
      }
    }

    // Large project alert
    if (currentStep === 2 && !isTurnkeyPricing()) {
      const totalSqft = (formData.areas || []).reduce((sum, area) => {
        return sum + (area.selectedCategories || []).reduce((areaSum, catId) => {
          return areaSum + (parseFloat(area.quantities?.[catId]) || 0);
        }, 0);
      }, 0);

      if (totalSqft > 5000) {
        message.info(`Large project: ${Math.round(totalSqft).toLocaleString()} sq ft`, 2);
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEdit = (stepIndex) => {
    setCurrentStep(stepIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDetectClient = async (email, phone) => {
    try {
      const response = await quoteBuilderApi.detectClient(email, phone);
      if (response.success && response.data) {
        setDetectedClient(response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error detecting client:', error);
      return null;
    }
  };

  const handleClientDetectionResponse = (useExisting) => {
    if (useExisting && detectedClient?.client) {
      // Update form data with existing client info
      setFormData(prev => ({
        ...prev,
        clientId: detectedClient.client.id,
        customerName: detectedClient.client.name,
        customerEmail: detectedClient.client.email,
        customerPhone: detectedClient.client.phone,
        street: detectedClient.client.street,
        city: detectedClient.client.city,
        state: detectedClient.client.state,
        zipCode: detectedClient.client.zip
      }));
      message.success('Loaded existing client profile');
    } else {
      // Clear clientId to create new client
      setFormData(prev => ({ ...prev, clientId: null }));
    }
    // Clear detection state
    setDetectedClient(null);
  };

  // Determine pricing model type with normalization
  const getPricingModelType = () => {
    if (!formData.pricingSchemeId || !pricingSchemes.length) return null;
    const scheme = pricingSchemes.find(s => s.id === formData.pricingSchemeId);
    if (!scheme) return null;
    
    // Normalize legacy types to new types
    const typeMap = {
      'turnkey': 'turnkey',
      'sqft_turnkey': 'turnkey',
      'rate_based_sqft': 'rate_based_sqft',
      'sqft_labor_paint': 'rate_based_sqft',
      'production_based': 'production_based',
      'hourly_time_materials': 'production_based',
      'flat_rate_unit': 'flat_rate_unit',
      'unit_pricing': 'flat_rate_unit',
      'room_flat_rate': 'flat_rate_unit',
    };
    
    return typeMap[scheme.type] || 'rate_based_sqft'; // Default to rate-based
  };

  // Get friendly pricing model name for display
  const getPricingModelFriendlyName = () => {
    const type = getPricingModelType();
    const nameMap = {
      'turnkey': 'Standard Turnkey Pricing',
      'rate_based_sqft': 'Rate-Based Pricing (Labor + Materials)',
      'production_based': 'Production-Based Pricing (Time & Materials)',
      'flat_rate_unit': 'Flat Rate Unit Pricing'
    };
    return nameMap[type] || 'Rate-Based Pricing';
  };

  // Get pricing model description for guidance
  const getPricingModelDescription = () => {
    const type = getPricingModelType();
    const descMap = {
      'turnkey': 'All-inclusive pricing based on total home square footage. No detailed measurements needed.',
      'rate_based_sqft': 'Labor priced per square foot. Enter detailed measurements for each surface.',
      'production_based': "Labor based on estimated time and crew productivity. We'll calculate hours based on square footage and production rates.",
      'flat_rate_unit': 'Fixed price per item (door, window, cabinet, etc.). Simply count the number of units for each category.'
    };
    return descMap[type] || 'Enter measurements and select products for accurate pricing.';
  };

  // Check if current pricing model requires detailed area measurements
  const requiresDetailedAreas = () => {
    const type = getPricingModelType();
    return type === 'rate_based_sqft' || type === 'production_based';
  };

  // Check if current pricing model uses unit counts (no measurements)
  const usesUnitCounts = () => {
    const type = getPricingModelType();
    return type === 'flat_rate_unit';
  };

  // Check if current pricing model is production-based
  const isProductionBased = () => {
    const type = getPricingModelType();
    return type === 'production_based';
  };

  // Validate step data based on pricing model requirements
  const validateStepData = (step) => {
    const currentScheme = getCurrentPricingScheme();
    if (!currentScheme) {
      return { valid: false, message: 'Please select a pricing model' };
    }

    switch (step) {
      case 1: // Job Type
        if (!formData.pricingSchemeId) {
          return { valid: false, message: 'Please select a pricing model' };
        }
        if (!formData.jobType) {
          return { valid: false, message: 'Please select job type (Interior/Exterior)' };
        }
        return { valid: true };

      case 2: // Areas or Home Size
        if (isTurnkeyPricing()) {
          // Turnkey validation
          if (!formData.homeSqft || formData.homeSqft <= 0) {
            return { valid: false, message: 'Please enter home square footage' };
          }
          if (formData.homeSqft > 20000) {
            return { valid: false, message: 'Home size exceeds 20,000 sq ft. Contact support for large properties.' };
          }
          return { valid: true };
        } else {
          // Non-Turnkey validation
          if (!formData.areas || formData.areas.length === 0) {
            return { valid: false, message: 'Please add at least one area/room' };
          }

          // Validate each area
          for (const area of formData.areas) {
            const areaName = area.areaName || area.name || 'Unnamed Area';
            
            // Check for selected items in new laborItems structure
            const selectedItems = area.laborItems 
              ? area.laborItems.filter(item => item.selected)
              : (area.selectedCategories || []);
            
            // Check if any surfaces/items are selected
            if (selectedItems.length === 0) {
              return { valid: false, message: `Area "${areaName}" needs surfaces selected` };
            }

            // Validate quantities for selected items
            if (area.laborItems) {
              // New structure: laborItems with selected boolean
              for (const item of area.laborItems) {
                if (item.selected) {
                  const qty = parseFloat(item.quantity);
                  if (!qty || qty <= 0) {
                    const itemType = usesUnitCounts() ? 'quantity' : 'measurement';
                    return { valid: false, message: `Enter ${itemType} for ${item.categoryName} in "${areaName}"` };
                  }
                }
              }
            } else if (area.selectedCategories) {
              // Old structure: selectedCategories array
              if (usesUnitCounts()) {
                // Unit-based: check quantities
                for (const catId of area.selectedCategories) {
                  const qty = area.quantities?.[catId];
                  if (!qty || qty <= 0) {
                    return { valid: false, message: `Enter quantity for all items in "${areaName}"` };
                  }
                }
              } else if (requiresDetailedAreas()) {
                // Sq ft-based: check measurements
                for (const catId of area.selectedCategories) {
                  const qty = area.quantities?.[catId];
                  if (!qty || qty <= 0) {
                    return { valid: false, message: `Enter square footage for surfaces in "${areaName}"` };
                  }
                }
              }
            }
          }

          // Check minimum project size
          if (requiresDetailedAreas()) {
            let totalSqft = 0;
            
            for (const area of formData.areas) {
              if (area.laborItems) {
                // New structure: sum quantity from selected laborItems with sqft unit
                totalSqft += area.laborItems
                  .filter(item => item.selected && item.measurementUnit === 'sqft')
                  .reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
              } else if (area.selectedCategories) {
                // Old structure: sum from quantities object
                totalSqft += (area.selectedCategories || []).reduce((areaSum, catId) => {
                  return areaSum + (parseFloat(area.quantities?.[catId]) || 0);
                }, 0);
              }
            }

            if (totalSqft < 50) {
              return { valid: false, message: 'Minimum 50 sq ft required' };
            }
          }
          return { valid: true };
        }

      case 3: // Products (index varies based on turnkey)
        if (!formData.includeMaterials) {
          return { valid: true }; // Materials optional
        }
        return { valid: true };

      default:
        return { valid: true };
    }
  };

  // Get current pricing scheme object
  const getCurrentPricingScheme = () => {
    if (!formData.pricingSchemeId || !pricingSchemes.length) return null;
    return pricingSchemes.find(s => s.id === formData.pricingSchemeId);
  };

  // Determine if current pricing scheme is turnkey
  const isTurnkeyPricing = () => {
    return getPricingModelType() === 'turnkey';
  };

  // Dynamic steps based on pricing model
  const dynamicSteps = isTurnkeyPricing() ? [
    { id: 0, title: 'Customer Info', icon: UserOutlined },
    { id: 1, title: 'Home Size & Scope', icon: HomeOutlined },
    { id: 2, title: 'Products', icon: BgColorsOutlined },
    { id: 3, title: 'Summary', icon: FileTextOutlined }
  ] : steps;

  const progress = ((currentStep + 1) / dynamicSteps.length) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <CustomerInfoStep
            formData={formData}
            onUpdate={handleStepDataUpdate}
            onNext={handleNext}
            pricingSchemes={pricingSchemes}
            onDetectClient={handleDetectClient}
            detectedClient={detectedClient}
            onClientDetectionResponse={handleClientDetectionResponse}
          />
        );
      
      case 1:
        // For turnkey: show Home Size & Scope, for others: show Job Type
        if (isTurnkeyPricing()) {
          return (
            <HomeSizeStep
              formData={formData}
              setFormData={setFormData}
              onNext={handleNext}
              onPrevious={handlePrevious}
              pricingSchemes={pricingSchemes}
            />
          );
        } else {
          return (
            <JobTypeStep
              formData={formData}
              onUpdate={handleStepDataUpdate}
              onNext={handleNext}
              onPrevious={handlePrevious}
              pricingSchemes={pricingSchemes}
            />
          );
        }
      
      case 2:
        // For turnkey: Products, for others: Areas
        if (isTurnkeyPricing()) {
          return (
            <ProductsStep
              formData={{
                ...formData,
                pricingModelType: getPricingModelType(),
                pricingModelFriendlyName: getPricingModelFriendlyName(),
                pricingModelDescription: getPricingModelDescription()
              }}
              onUpdate={handleStepDataUpdate}
              onNext={handleNext}
              onPrevious={handlePrevious}
              pricingSchemes={pricingSchemes}
            />
          );
        } else {
          // Use ExteriorAreasStep for exterior jobs, AreasStepEnhanced for interior
          const enhancedFormData = {
            ...formData,
            pricingModelType: getPricingModelType(),
            pricingModelFriendlyName: getPricingModelFriendlyName(),
            pricingModelDescription: getPricingModelDescription()
          };
          
          return formData.jobType === 'exterior' ? (
            <ExteriorAreasStep
              formData={enhancedFormData}
              onUpdate={handleStepDataUpdate}
              onNext={handleNext}
              onPrevious={handlePrevious}
            />
          ) : (
            <AreasStepEnhanced
              formData={enhancedFormData}
              onUpdate={handleStepDataUpdate}
              onNext={handleNext}
              onPrevious={handlePrevious}
            />
          );
        }
      
      case 3:
        // For turnkey: Summary, for others: Products
        if (isTurnkeyPricing()) {
          return (
            <SummaryStep
              formData={formData}
              onUpdate={handleStepDataUpdate}
              onPrevious={handlePrevious}
              onEdit={handleEdit}
              pricingSchemes={pricingSchemes}
            />
          );
        } else {
          return (
            <ProductsStep
              formData={formData}
              onUpdate={handleStepDataUpdate}
              onNext={handleNext}
              onPrevious={handlePrevious}
              pricingSchemes={pricingSchemes}
            />
          );
        }
      
      case 4:
        // Only for non-turnkey: Summary
        return (
          <SummaryStep
            formData={formData}
            onUpdate={handleStepDataUpdate}
            onPrevious={handlePrevious}
            onEdit={handleEdit}
            pricingSchemes={pricingSchemes}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl md:text-3xl font-bold">
              {isEditMode ? 'Edit Quote' : 'Create New Quote'}
            </h2>
            <div className="flex items-center gap-3">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  fetchPricingSchemes();
                  message.success('Settings refreshed');
                }}
                title="Refresh contractor settings"
              >
                Refresh Settings
              </Button>
              <span className="text-sm text-gray-500">
                Step {currentStep + 1} of {dynamicSteps.length}
              </span>
            </div>
          </div>
          
          <Progress percent={progress} showInfo={false} className="mb-6" />
          
          {/* Step Indicators */}
          <Steps current={currentStep} className="hidden md:flex">
            {dynamicSteps.map((step) => (
              <Steps.Step
                key={step.id}
                title={step.title}
                icon={<step.icon />}
              />
            ))}
          </Steps>
        </div>

        {/* Step Content */}
        <Card>
          <div className="mb-6">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              {(() => {
                const StepIcon = dynamicSteps[currentStep].icon;
                return <StepIcon className="text-blue-500" />;
              })()}
              {dynamicSteps[currentStep].title}
            </h3>
          </div>

          {renderStepContent()}
        </Card>

        {/* Auto-save indicator */}
        <div className="text-center text-xs text-gray-500 mt-4">
          Auto-saving every 30 seconds
          {formData.quoteId && ` • Draft ID: ${formData.quoteId}`}
        </div>
      </div>
    </div>
  );
}

export default QuoteBuilderPage;
