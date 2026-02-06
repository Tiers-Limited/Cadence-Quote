import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Card, Steps, message, Progress, Button, Modal, Grid } from 'antd';
import {
  UserOutlined,
  HomeOutlined,
  UnorderedListOutlined,
  BgColorsOutlined,
  FileTextOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { useBreakpoint } = Grid;
import CustomerInfoStep from '../components/QuoteBuilder/CustomerInfoStep';
import JobTypeStep from '../components/QuoteBuilder/JobTypeStep';
import AreasStepEnhanced from '../components/QuoteBuilder/AreasStepEnhanced';
import ExteriorAreasStep from '../components/QuoteBuilder/ExteriorAreasStep';
import HomeSizeStep from '../components/QuoteBuilder/HomeSizeStep';
import FlatRatePricingStep from '../components/QuoteBuilder/FlatRatePricingStep';
import ProductsStep from '../components/QuoteBuilder/ProductsStep';
import TierSelectionStep from '../components/QuoteBuilder/TierSelectionStep';
import SummaryStep from '../components/QuoteBuilder/SummaryStep';
import ConflictResolutionModal from '../components/QuoteBuilder/ConflictResolutionModal';
import { quoteBuilderApi } from '../services/quoteBuilderApi';
import { apiService } from '../services/apiService';
import * as pricingUtils from '../utils/pricingUtils';
import loadingService from '../services/loadingService';
import gbbSettingsApi from '../services/gbbSettingsApi';

// Helper function to get dynamic steps based on pricing model and GBB status
const getSteps = (isTurnkey, gbbEnabled = false) => {
  if (isTurnkey) {
    const baseSteps = [
      { id: 0, title: 'Customer Info', icon: UserOutlined },
      { id: 1, title: 'Job Type', icon: HomeOutlined },
      { id: 2, title: 'Home Size', icon: HomeOutlined },
      { id: 3, title: 'Products', icon: BgColorsOutlined }
    ];
    
    // Add tier selection step if GBB is enabled
    if (gbbEnabled) {
      baseSteps.push({ id: 4, title: 'Select Tier', icon: BgColorsOutlined });
    }
    
    baseSteps.push({ id: gbbEnabled ? 5 : 4, title: 'Summary', icon: FileTextOutlined });
    return baseSteps;
  } else {
    const baseSteps = [
      { id: 0, title: 'Customer Info', icon: UserOutlined },
      { id: 1, title: 'Job Type', icon: HomeOutlined },
      { id: 2, title: 'Areas', icon: UnorderedListOutlined },
      { id: 3, title: 'Products', icon: BgColorsOutlined }
    ];
    
    // Add tier selection step if GBB is enabled
    if (gbbEnabled) {
      baseSteps.push({ id: 4, title: 'Select Tier', icon: BgColorsOutlined });
    }
    
    baseSteps.push({ id: gbbEnabled ? 5 : 4, title: 'Summary', icon: FileTextOutlined });
    return baseSteps;
  }
};
  
function QuoteBuilderPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  
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
    crewSize: 2,
    productivityRate: null,
    
    // UI Layout fields (Task 2.1)
    paintersOnSite: 1, // 1-10 options
    laborOnly: false, // For Time and Materials schemes
    
    // Areas (Step 3) - for non-turnkey models
    areas: [],
    
    // Flat Rate Items (Step 3) - for flat rate pricing
    flatRateItems: {
      interior: {},
      exterior: {}
    },
    
    // Products (Step 4)
    productStrategy: 'GBB',
    allowCustomerProductChoice: false,
    productSets: [],
    
    // GBB Tier Selection (Step 4 or 5 depending on GBB enabled)
    gbbSelectedTier: null, // 'good', 'better', or 'best'
    gbbTierPricing: {}, // Stores pricing for all tiers
    
    // Summary (Step 5 or 6)
    notes: '',
    
    // Pricing defaults from settings
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
  const [steps, setSteps] = useState(getSteps(false, false)); // Initialize with non-turnkey, no GBB steps
  
  // GBB Tier Selection State
  const [tierPricing, setTierPricing] = useState(null);
  const [gbbEnabled, setGbbEnabled] = useState(false);

  // Enhanced auto-save state
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  const [lastModified, setLastModified] = useState(null);
  const [autoSaveVersion, setAutoSaveVersion] = useState(1);

  const autoSaveInterval = useRef(null);
  const lastSaveTime = useRef(Date.now());

  // ============================================================================
  // SINGLE SOURCE OF TRUTH: Consolidated labor data fetching
  // This is the ONLY place where labor categories and rates should be fetched
  // ============================================================================
  const fetchLaborData = useCallback(async (jobType, schemeType) => {
    // Safety checks
    if (!jobType) {
      console.log('[QuoteBuilder] No job type provided to fetchLaborData, clearing labor data');
      setContractorSettings(prev => ({
        ...prev,
        laborCategories: [],
        laborRates: {},
        productionRates: {},
        flatRateUnitPrices: {},
        turnkey: { interior: 0, exterior: 0 },
        other: { ...prev.other, defaultBillableLaborRate: null }
      }));
      return;
    }

    // Determine pricing mode
    const mode = pricingUtils.getPricingMode(schemeType || '');
    const needsLaborData = ['rate_sqft', 'production', 'flat_unit', 'turnkey'].includes(mode);

    console.log(`[QuoteBuilder] fetchLaborData called: jobType=${jobType}, schemeType=${schemeType}, mode=${mode}, needsLaborData=${needsLaborData}`);

    if (!needsLaborData) {
      console.log('[QuoteBuilder] Scheme does not need labor data, clearing it');
      setContractorSettings(prev => ({
        ...prev,
        laborCategories: [],
        laborRates: {},
        productionRates: {},
        flatRateUnitPrices: {},
        turnkey: { interior: 0, exterior: 0 },
        other: { ...prev.other, defaultBillableLaborRate: null }
      }));
      return;
    }

    // Show loading indicator
    const loadingKey = 'fetchLaborData';
    message.loading({ content: 'Loading pricing data...', key: loadingKey, duration: 0 });

    try {
      // Route based on pricing mode
      if (mode === 'production' || mode === 'flat_unit' || mode === 'turnkey') {
        // Turnkey, Production-based, and Flat-rate pricing: fetch from product-configs/defaults
        console.log(`[QuoteBuilder] Fetching pricing data from product-configs/defaults for ${mode} pricing...`);
        const defaultsResponse = await apiService.getProductConfigDefaults();
        
        if (defaultsResponse.success && defaultsResponse.data) {
          const defaults = defaultsResponse.data;
          
          // Extract production rates (for production-based pricing)
          const productionRates = {
            interiorWalls: defaults.productionInteriorWalls || 300,
            interiorCeilings: defaults.productionInteriorCeilings || 250,
            interiorTrim: defaults.productionInteriorTrim || 150,
            exteriorWalls: defaults.productionExteriorWalls || 250,
            exteriorTrim: defaults.productionExteriorTrim || 120,
            soffitFascia: defaults.productionSoffitFascia || 100,
            doors: defaults.productionDoors || 2,
            cabinets: defaults.productionCabinets || 1.5
          };
          
          // Extract billable labor rate (for production-based pricing)
          const billableLaborRate = defaults.defaultBillableLaborRate || 50;
          
          // Extract turnkey rates (for turnkey pricing)
          const turnkeyRates = {
            interior: defaults.turnkeyInteriorRate || 3.50,
            exterior: defaults.turnkeyExteriorRate || 3.50
          };
          
          // Extract flat rate unit prices (for flat-rate pricing)
          const flatRateUnitPrices = defaults.flatRateUnitPrices || {
            walls: 2.5,
            ceilings: 2,
            interior_trim: 1.5,
            siding: 3,
            exterior_trim: 1.8,
            soffit_fascia: 2,
            gutters: 4,
            deck: 2.5,
            door: 85,
            window: 75,
            cabinet: 125,
            room_small: 350,
            room_medium: 450,
            room_large: 600
          };
          
          console.log(`[QuoteBuilder] Pricing data loaded for ${mode}:`, {
            billableLaborRate: mode === 'production' ? billableLaborRate : 'N/A',
            turnkeyRates: mode === 'turnkey' ? turnkeyRates : 'N/A',
            flatRateUnitPrices: mode === 'flat_unit' ? 'Loaded' : 'N/A'
          });
          
          // Update contractor settings with pricing data
          setContractorSettings(prev => ({
            ...prev,
            productionRates: mode === 'production' ? productionRates : {},
            turnkey: mode === 'turnkey' ? turnkeyRates : prev.turnkey,
            flatRateUnitPrices: mode === 'flat_unit' ? flatRateUnitPrices : {},
            laborCategories: [], // Clear labor categories for non-rate-based modes
            laborRates: {}, // Clear labor rates for non-rate-based modes
            other: {
              ...prev.other,
              defaultBillableLaborRate: mode === 'production' ? billableLaborRate : null,
              coverage: defaults.coverage || 350,
              applicationMethod: defaults.applicationMethod || 'roll',
              coats: defaults.coats || 2,
              crewSize: defaults.crewSize || 1
            }
          }));
          
          // Mirror in formData for child components
          setFormData(prev => ({
            ...prev,
            billableLaborRate: mode === 'production' ? billableLaborRate : prev.billableLaborRate,
            contractorSettings: {
              ...prev.contractorSettings,
              productionRates: mode === 'production' ? productionRates : {},
              turnkey: mode === 'turnkey' ? turnkeyRates : prev.contractorSettings?.turnkey,
              flatRateUnitPrices: mode === 'flat_unit' ? flatRateUnitPrices : {},
              laborCategories: [],
              laborRates: {},
              other: {
                ...prev.contractorSettings?.other,
                defaultBillableLaborRate: mode === 'production' ? billableLaborRate : null,
                coverage: defaults.coverage || 350,
                applicationMethod: defaults.applicationMethod || 'roll',
                coats: defaults.coats || 2,
                crewSize: defaults.crewSize || 1
              }
            },
            _laborDataUpdated: Date.now()
          }));
          
          message.success({ content: 'Pricing data loaded successfully', key: loadingKey, duration: 2 });
        }
      } else if (mode === 'rate_sqft') {
        // Rate-based pricing: fetch labor categories and rates
        console.log(`[QuoteBuilder] Fetching labor data for jobType=${jobType}...`);
        const [laborCategoriesRes, laborRatesRes] = await Promise.all([
          apiService.get(`/labor-categories?jobType=${jobType}`),
          apiService.get(`/labor-categories/rates?jobType=${jobType}`)
        ]);

        const laborRatesMap = {};
        if (laborRatesRes.success && Array.isArray(laborRatesRes.data)) {
          laborRatesRes.data.forEach((rateRecord) => {
            laborRatesMap[rateRecord.laborCategoryId] = Number.parseFloat(rateRecord.rate) || 0;
          });
        }

        const categories = laborCategoriesRes.success ? laborCategoriesRes.data : [];
        console.log(`[QuoteBuilder] Labor data loaded: ${categories.length} categories, ${Object.keys(laborRatesMap).length} rates`);

        // Update contractor settings with labor data
        setContractorSettings(prev => ({
          ...prev,
          laborCategories: categories,
          laborRates: laborRatesMap,
          productionRates: {}, // Clear production rates for rate-based mode
          flatRateUnitPrices: {}, // Clear flat rate prices for rate-based mode
          other: {
            ...prev.other,
            defaultBillableLaborRate: null // Clear billable labor rate for rate-based mode
          }
        }));

        // Mirror in formData for child components
        setFormData(prev => ({
          ...prev,
          contractorSettings: {
            ...prev.contractorSettings,
            laborCategories: categories,
            laborRates: laborRatesMap,
            productionRates: {},
            flatRateUnitPrices: {},
            other: {
              ...prev.contractorSettings?.other,
              defaultBillableLaborRate: null
            }
          },
          _laborDataUpdated: Date.now()
        }));
        
        message.success({ content: 'Labor data loaded successfully', key: loadingKey, duration: 2 });
      }
    } catch (error) {
      console.error('[QuoteBuilder] Failed to fetch labor data:', error);
      message.error({ content: 'Failed to load pricing data', key: loadingKey, duration: 3 });
    }
  }, []);
  // ============================================================================

  // ============================================================================
  // TIER PRICING CALCULATION: Calculate pricing for all GBB tiers
  // ============================================================================
  const calculateTierPricing = useCallback(async () => {
    // Only calculate if we have the necessary data
    const hasAreas = formData.areas && formData.areas.length > 0;
    const hasTurnkeyData = formData.homeSqft && formData.homeSqft > 0;
    const hasFlatRateItems = formData.flatRateItems && (
      Object.values(formData.flatRateItems.interior || {}).some(count => count > 0) ||
      Object.values(formData.flatRateItems.exterior || {}).some(count => count > 0)
    );

    if (!hasAreas && !hasTurnkeyData && !hasFlatRateItems) {
      console.log('[QuoteBuilder] No data for tier pricing calculation');
      return;
    }

    if (!formData.pricingSchemeId) {
      console.log('[QuoteBuilder] No pricing scheme selected');
      return;
    }

    try {
      console.log('[QuoteBuilder] Calculating tier pricing...');
      
      const params = {
        pricingSchemeId: formData.pricingSchemeId,
        areas: formData.areas || [],
        homeSqft: formData.homeSqft,
        jobScope: formData.jobScope,
        jobType: formData.jobType,
        numberOfStories: formData.numberOfStories,
        conditionModifier: formData.conditionModifier,
        flatRateItems: formData.flatRateItems,
        productSets: formData.productSets || [],
        includeMaterials: formData.includeMaterials,
        coverage: formData.coverage,
        applicationMethod: formData.applicationMethod,
        coats: formData.coats
      };

      const response = await gbbSettingsApi.calculateTierPricing(params);
      
      if (response.success && response.data) {
        console.log('[QuoteBuilder] Tier pricing calculated:', response.data);
        setTierPricing(response.data);
        setGbbEnabled(response.data.gbbEnabled || false);
        
        // Update formData with tier pricing
        setFormData(prev => ({
          ...prev,
          gbbTierPricing: response.data
        }));
      } else {
        console.log('[QuoteBuilder] GBB not enabled or calculation failed');
        setTierPricing(null);
        setGbbEnabled(false);
      }
    } catch (error) {
      console.error('[QuoteBuilder] Failed to calculate tier pricing:', error);
      setTierPricing(null);
      setGbbEnabled(false);
    }
  }, [formData.areas, formData.homeSqft, formData.flatRateItems, formData.productSets, 
      formData.pricingSchemeId, formData.jobType, formData.jobScope, formData.numberOfStories,
      formData.conditionModifier, formData.includeMaterials, formData.coverage, 
      formData.applicationMethod, formData.coats]);
  // ============================================================================

  // Routing/context: detect edit mode via URL or navigation state
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const quoteIdFromUrl = searchParams.get('quoteId');
  const editQuote = location?.state?.quote || location?.state?.editQuote || null;
  const isEditMode = Boolean(quoteIdFromUrl || editQuote || formData.quoteId);

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
    const isFlatRate = selectedScheme.type === 'flat_rate_unit' || selectedScheme.type === 'unit_pricing' || selectedScheme.type === 'room_flat_rate';
    const hasAreas = formData.areas && formData.areas.length > 0;
    const hasHomeSqft = formData.homeSqft && formData.homeSqft > 0;
    const hasFlatRateItems = formData.flatRateItems && (
      Object.values(formData.flatRateItems.interior || {}).some(count => count > 0) ||
      Object.values(formData.flatRateItems.exterior || {}).some(count => count > 0)
    );
    
    console.log(`[QuoteBuilder] Pricing scheme change detected: isTurnkey=${isTurnkey}, isFlatRate=${isFlatRate}, hasAreas=${hasAreas}, hasHomeSqft=${hasHomeSqft}, hasFlatRateItems=${hasFlatRateItems}`);
    
    // If switching to flat rate and has areas data
    if (isFlatRate && hasAreas && !hasFlatRateItems) {
      message.warning({
        content: 'Switched to Flat Rate pricing. Room measurements are not needed. They have been cleared.',
        duration: 5
      });
      
      // Clear areas since flat rate doesn't use them
      setFormData(prev => ({
        ...prev,
        areas: [],
        productSets: [],
        flatRateItems: prev.flatRateItems || { interior: {}, exterior: {} },
        _lastPricingSchemeId: formData.pricingSchemeId
      }));
    }
    // If switching from flat rate to areas-based and has flat rate items
    else if (!isFlatRate && !isTurnkey && hasFlatRateItems && !hasAreas) {
      message.warning({
        content: 'Switched from Flat Rate pricing. You will need to add room measurements.',
        duration: 5
      });
      
      // Clear flat rate items and productSets to force rebuild
      setFormData(prev => ({
        ...prev,
        flatRateItems: { interior: {}, exterior: {} },
        productSets: [], // Force rebuild based on new areas
        _lastPricingSchemeId: formData.pricingSchemeId
      }));
    }
    // If switching from non-turnkey to turnkey and has areas data
    else if (isTurnkey && hasAreas && !hasHomeSqft) {
      message.warning({
        content: 'Switched to Turnkey pricing. Room measurements and products are not needed. They have been cleared.',
        duration: 5
      });
      
      // Clear areas and productSets since turnkey doesn't use them
      setFormData(prev => ({
        ...prev,
        areas: [],
        productSets: [],
        flatRateItems: { interior: {}, exterior: {} }, // Clear flat rate items too
        homeSqft: prev.homeSqft || null,
        jobScope: prev.jobScope || 'both',
        numberOfStories: prev.numberOfStories || 1,
        conditionModifier: prev.conditionModifier || 'average',
        _lastPricingSchemeId: formData.pricingSchemeId
      }));
    }
    // If switching from turnkey to non-turnkey and has home sqft
    else if (!isTurnkey && hasHomeSqft && !hasAreas && !hasFlatRateItems) {
      message.warning({
        content: 'Switched from Turnkey pricing. You will need to add room measurements or select items.',
        duration: 5
      });
      
      // Clear turnkey-specific fields AND productSets to force rebuild
      setFormData(prev => ({
        ...prev,
        homeSqft: null,
        jobScope: 'both',
        numberOfStories: 1,
        conditionModifier: 'average',
        productSets: [], // Force rebuild based on new areas
        _lastPricingSchemeId: formData.pricingSchemeId
      }));
      
      // Note: Labor data will be fetched when user navigates to Areas step
    }
    // If switching between non-turnkey types, clear productSets and areas to force sync
    else if (!isTurnkey && !isFlatRate && hasAreas) {
      const prevSchemeId = formData._lastPricingSchemeId;
      if (prevSchemeId && prevSchemeId !== formData.pricingSchemeId) {
        // message.info({
        //   content: 'Pricing scheme changed. Areas cleared. Labor rates will load when you return to Areas step.',
        //   duration: 4
        // });
        
        setFormData(prev => ({
          ...prev,
          areas: [], // Clear to force rebuild with correct categories
          productSets: [], // Clear to force rebuild
          flatRateItems: { interior: {}, exterior: {} }, // Clear flat rate items
          _lastPricingSchemeId: formData.pricingSchemeId,
          contractorSettings: {
            ...prev.contractorSettings,
            laborCategories: [],
            laborRates: {}
          }
        }));
      }
    }
    // Store the last pricing scheme ID for change detection
    else if (!isTurnkey && !hasAreas && !hasFlatRateItems) {
      setFormData(prev => ({
        ...prev,
        _lastPricingSchemeId: formData.pricingSchemeId
      }));
    }
  }, [formData.pricingSchemeId, pricingSchemes, fetchLaborData]);

  // Watch for job type changes and clear areas to prevent showing wrong surface types
  useEffect(() => {
    // Skip on initial mount
    if (!formData.jobType || !formData.pricingSchemeId) return;
    
    // Skip if this is the initial job type setting (no previous job type stored)
    const prevJobType = formData._lastJobType;
    if (!prevJobType) {
      // Store the initial job type
      setFormData(prev => ({
        ...prev,
        _lastJobType: formData.jobType
      }));
      return;
    }
    
    // Only proceed if job type actually changed
    if (prevJobType === formData.jobType) return;
    
    // message.info({
    //   content: `Job type changed to ${formData.jobType}. Areas cleared. Labor rates will load when you go to Areas step.`,
    //   duration: 4
    // });
    
    // Clear areas, products, and labor data when job type changes
    setFormData(prev => ({
      ...prev,
      areas: [],
      productSets: [],
      _lastJobType: formData.jobType,
      contractorSettings: {
        ...prev.contractorSettings,
        laborCategories: [],
        laborRates: {}
      }
    }));
  }, [formData.jobType, formData.pricingSchemeId, pricingSchemes, fetchLaborData]);

//   // Calculate tier pricing when areas, products, or turnkey data changes
//   useEffect(() => {
//     // Debounce the calculation to avoid excessive API calls
//     const timer = setTimeout(() => {
//       calculateTierPricing();
//     }, 500);

//     return () => clearTimeout(timer);
//   }, [
//     JSON.stringify(formData.areas),
//     JSON.stringify(formData.productSets),
//     formData.homeSqft,
//     formData.jobScope,
//     formData.numberOfStories,
//     formData.conditionModifier,
//     JSON.stringify(formData.flatRateItems),
//     formData.pricingSchemeId
//   ]);

  // Update steps based on pricing scheme (don't fetch labor data automatically)
  useEffect(() => {
    if (formData.pricingSchemeId && pricingSchemes.length > 0) {
      const selectedScheme = pricingSchemes.find(s => s.id === formData.pricingSchemeId);
      if (!selectedScheme) return;

      // Update steps based on pricing model and GBB status
      const isTurnkey = selectedScheme.type === 'turnkey' || selectedScheme.type === 'sqft_turnkey';
      const newSteps = getSteps(isTurnkey, gbbEnabled);
      
      // Force steps update
      setSteps([...newSteps]);
      
      // Reset current step to 0 if we're beyond the new number of steps
      if (currentStep >= newSteps.length) {
        setCurrentStep(0);
      }

      // Note: Labor data will be fetched when transitioning to Areas step
    }
  }, [formData.pricingSchemeId, pricingSchemes, currentStep, gbbEnabled]);

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
           schemeType === 'flat_rate_unit' ||
           schemeType === 'hourly_time_materials');
        
        // NOTE: Don't fetch labor categories/rates here without jobType
        // They will be fetched by the fetchLaborData callback when jobType is set
        let laborCategoriesRes = { success: true, data: [] };
        let laborRatesRes = { success: true, data: [] };
        
        // Only fetch if we're in edit mode and have a jobType already
        if (needsLaborData && formData.jobType) {
          console.log(`[QuoteBuilder] Initial load: Fetching labor data for jobType=${formData.jobType}`);
          [laborCategoriesRes, laborRatesRes] = await Promise.all([
            apiService.get(`/labor-categories?jobType=${formData.jobType}`),
            apiService.get('/labor-categories/rates')
          ]);
        }
        
        // Transform labor rates array into a map for easier lookup
        const laborRatesMap = {};
        if (laborRatesRes.success && Array.isArray(laborRatesRes.data)) {
          laborRatesRes.data.forEach((rateRecord) => {
            laborRatesMap[rateRecord.laborCategoryId] = parseFloat(rateRecord.rate) || 0;
          });
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
          laborRates: laborRatesMap,
          flatRateUnitPrices: defaults.flatRateUnitPrices || {},
          other: {
            taxRate: settings.taxRatePercentage || 8.25,
            depositPercentage: settings.depositPercentage || 50,
            includeMaterials: defaults.includeMaterials !== undefined ? defaults.includeMaterials : true,
            coverage: defaults.coverage || 350,
            applicationMethod: defaults.applicationMethod || 'roll',
            coats: defaults.coats || 2,
            defaultBillableLaborRate: defaults.defaultBillableLaborRate || 50,
            crewSize: defaults.crewSize || 1,
            quoteValidityDays: defaults.quoteValidityDays || 30
          }
        };
        
        setContractorSettings(fullSettings);
        
        // Store all settings in formData if not already set
        setFormData(prev => ({
          ...prev,
          // Pricing settings
          defaultTax: prev.defaultTax ?? settings.taxRatePercentage ?? 8.25,
          defaultDeposit: prev.defaultDeposit ?? settings.depositPercentage ?? 50,
          
          // Material settings (from Pricing Engine)
          includeMaterials: prev.includeMaterials ?? fullSettings.other.includeMaterials,
          coverage: prev.coverage ?? fullSettings.other.coverage,
          applicationMethod: prev.applicationMethod ?? fullSettings.other.applicationMethod,
          coats: prev.coats ?? fullSettings.other.coats,
          
          // Production-based settings (from Pricing Engine)
          billableLaborRate: prev.billableLaborRate ?? fullSettings.other.defaultBillableLaborRate,
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
      const isFlatRateQuote = quoteScheme && (quoteScheme.type === 'flat_rate_unit' || quoteScheme.type === 'unit_pricing' || quoteScheme.type === 'room_flat_rate');
      
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
        billableLaborRate: quote.billableLaborRate || formData.billableLaborRate,
        crewSize: quote.crewSize || formData.crewSize,
        productivityRate: quote.productivityRate || formData.productivityRate,
        
        // Areas - only load if NOT turnkey and NOT flat rate
        areas: (isTurnkeyQuote || isFlatRateQuote) ? [] : (quote.areas || []),
        
        // Flat Rate Items - only load if flat rate
        flatRateItems: isFlatRateQuote ? (quote.flatRateItems || { interior: {}, exterior: {} }) : { interior: {}, exterior: {} },
        
        // Products
        productStrategy: quote.productStrategy || 'GBB',
        allowCustomerProductChoice: quote.allowCustomerProductChoice || false,
        productSets: (isTurnkeyQuote || isFlatRateQuote) ? [] : (quote.productSets || []),
        
        // Summary
        notes: quote.notes || '',
        
        // Internal
        quoteId: quote.id,
        clientId: quote.clientId || null,
        status: quote.status || 'draft'
      };
      
      setFormData(baseData);
      
      // Set auto-save metadata
      setLastModified(quote.lastModified);
      setAutoSaveVersion(quote.autoSaveVersion || 1);
      
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
          content: `Found draft quote from ${new Date(latestDraft.updatedAt).toLocaleDateString("en-US",{
        month: 'short', day: 'numeric', year: 'numeric'
      })}. Loading...`,
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
      
      // Prepare base draft data
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
        billableLaborRate: draft.billableLaborRate || formData.billableLaborRate,
        crewSize: draft.crewSize || formData.crewSize,
        productivityRate: draft.productivityRate || formData.productivityRate,
        // Store tracking fields
        _lastPricingSchemeId: draft.pricingSchemeId,
        _lastJobType: draft.jobType
      };
      
      // If current pricing scheme differs from draft, clear incompatible data
      if (formData.pricingSchemeId && formData.pricingSchemeId !== draft.pricingSchemeId) {
        message.warning({
          content: 'Draft uses different pricing scheme. Areas and products have been cleared. Please rebuild your quote.',
          duration: 5
        });
        
        // Clear areas and products since pricing scheme changed
        draftData.areas = [];
        draftData.productSets = [];
        draftData.homeSqft = null;
        
        // Update to use current scheme selection instead of draft's scheme
        draftData.pricingSchemeId = formData.pricingSchemeId;
        draftData._lastPricingSchemeId = formData.pricingSchemeId;
      } else if (isTurnkeyDraft) {
        // Pricing scheme matches and it's turnkey - load turnkey data, clear non-turnkey fields
        draftData.areas = [];
        draftData.productSets = [];
      } else {
        // Pricing scheme matches and it's non-turnkey - load non-turnkey data, clear turnkey fields
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

    // Wrap auto-save with loading service
    const wrappedAutoSave = loadingService.wrapAutoSave(async () => {
      // Include lastModified timestamp for optimistic locking
      const saveData = {
        ...formData,
        lastModified: lastModified
      };

      const response = await quoteBuilderApi.saveDraft(saveData);
      
      // Check for conflicts
      if (response.conflict) {
        setConflictData(response.conflictData);
        setConflictModalVisible(true);
        return;
      }
      
      // Update quote ID if this was a new quote
      if (!formData.quoteId && response.data?.id) {
        setFormData(prev => ({ ...prev, quoteId: response.data.id }));
      }

      // Update auto-save metadata
      if (response.quote || response.data) {
        const quote = response.quote || response.data;
        setLastModified(quote.lastModified);
        setAutoSaveVersion(quote.autoSaveVersion);
      }

      // Update auto-save metadata from response
      if (response.autoSave) {
        setLastModified(response.autoSave.lastModified);
        setAutoSaveVersion(response.autoSave.version);
      }
      
      lastSaveTime.current = Date.now();
      console.log('Auto-saved successfully', { version: autoSaveVersion });
    });

    try {
      await wrappedAutoSave();
    } catch (error) {
      console.error('Auto-save failed:', error);
      
      // Check if it's a conflict error that wasn't handled by the API wrapper
      if (error.response && error.response.status === 409) {
        const conflictData = error.response.data;
        if (conflictData.conflict) {
          setConflictData(conflictData);
          setConflictModalVisible(true);
          return;
        }
      }
      
      message.error('Auto-save failed. Please save manually.');
    }
  };

  const handleConflictResolution = async (resolution, data) => {
    try {
      if (resolution === 'server') {
        // Use server data - reload the quote
        const serverQuote = data.quote;
        loadQuoteForEdit(serverQuote);
        setLastModified(serverQuote.lastModified);
        setAutoSaveVersion(serverQuote.autoSaveVersion);
        message.success('Server version loaded successfully');
      } else {
        // Use client data - resolve conflict with our data
        const response = await quoteBuilderApi.resolveConflict(
          formData.quoteId, 
          'client', 
          formData
        );
        
        if (response.success) {
          setLastModified(response.quote.lastModified);
          setAutoSaveVersion(response.quote.autoSaveVersion);
          message.success('Your changes have been saved');
        }
      }
      
      setConflictModalVisible(false);
      setConflictData(null);
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      message.error('Failed to resolve conflict. Please try again.');
    }
  };

  const handleConflictCancel = () => {
    setConflictModalVisible(false);
    setConflictData(null);
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

    // Fetch labor data when transitioning FROM Job Type TO Areas step
    if (currentStep === 1 && !isTurnkeyPricing()) {
      const selectedScheme = pricingSchemes.find(s => s.id === formData.pricingSchemeId);
      if (selectedScheme && formData.jobType) {
        // Check if labor data is already loaded for this job type
        const hasLaborData = contractorSettings.laborCategories?.length > 0;
        const laborDataMatchesJobType = contractorSettings.laborCategories?.some(
          cat => cat.categoryType === formData.jobType
        );
        
        if (!hasLaborData || !laborDataMatchesJobType) {
          console.log(`[QuoteBuilder] Transitioning to Areas step: Fetching labor data for jobType=${formData.jobType}`);
          message.loading({ content: 'Loading labor categories...', key: 'laborData' });
          
          fetchLaborData(formData.jobType, selectedScheme.type).then(() => {
            message.success({ content: 'Labor rates loaded', key: 'laborData', duration: 2 });
            // Move to next step after data is loaded
            setCurrentStep(currentStep + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }).catch(() => {
            message.error({ content: 'Failed to load labor rates', key: 'laborData' });
          });
          return; // Don't proceed until data is loaded
        }
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

  // Handle tier selection
  const handleTierSelect = (tier) => {
    console.log('[QuoteBuilder] Tier selected:', tier);
    setFormData(prev => ({
      ...prev,
      gbbSelectedTier: tier
    }));
    message.success(`${tier.charAt(0).toUpperCase() + tier.slice(1)} tier selected`);
  };

  // Determine pricing model type with normalization + robust logging
  const getPricingModelType = () => {
    if (!formData.pricingSchemeId) {
      console.debug('[QuoteBuilder] getPricingModelType: No scheme selected');
      return null;
    }

    if (!pricingSchemes.length) {
      console.debug('[QuoteBuilder] getPricingModelType: Pricing schemes not loaded yet');
      return null;
    }

    const scheme = pricingSchemes.find(s => s.id === formData.pricingSchemeId);
    if (!scheme) {
      console.warn(`[QuoteBuilder] getPricingModelType: Scheme not found for id ${formData.pricingSchemeId}`);
      return 'rate_based_sqft'; // Safe fallback
    }
    
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
    
    const normalized = scheme.type?.toLowerCase() || '';
    const modelType = typeMap[normalized] || 'rate_based_sqft';
    
    console.debug(`[QuoteBuilder] getPricingModelType: scheme.type="${scheme.type}" → "${modelType}"`);
    return modelType;
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

      case 2: // Areas, Home Size, or Flat Rate Items
        if (isTurnkeyPricing()) {
          // Turnkey validation
          if (!formData.homeSqft || formData.homeSqft <= 0) {
            return { valid: false, message: 'Please enter home square footage' };
          }
          if (formData.homeSqft > 20000) {
            return { valid: false, message: 'Home size exceeds 20,000 sq ft. Contact support for large properties.' };
          }
          return { valid: true };
        } else if (usesUnitCounts()) {
          // Flat Rate validation
          const flatRateItems = formData.flatRateItems || { interior: {}, exterior: {} };
          const totalItems = Object.values(flatRateItems.interior || {}).reduce((sum, count) => sum + (count || 0), 0) +
                            Object.values(flatRateItems.exterior || {}).reduce((sum, count) => sum + (count || 0), 0);
          
          if (totalItems === 0) {
            return { valid: false, message: 'Please select at least one item' };
          }
          return { valid: true };
        } else {
          // Non-Turnkey, Non-Flat Rate validation (Areas-based)
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

          // Check minimum project size for areas-based pricing
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

      case 4: // Either Tier Selection or Summary
        if (gbbEnabled && tierPricing) {
          // Tier selection validation
          if (!formData.gbbSelectedTier) {
            return { valid: false, message: 'Please select a pricing tier' };
          }
        }
        return { valid: true };

      case 5: // Summary (only when GBB enabled)
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
    const isT = getPricingModelType() === 'turnkey';
    console.debug(`[QuoteBuilder] isTurnkeyPricing: ${isT}`);
    return isT;
  };



  const progress = ((currentStep + 1) / steps.length) * 100;

  const renderStepContent = () => {
    console.log(`[QuoteBuilder] Rendering step ${currentStep}: ${steps[currentStep]?.title}`);
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
        // Job Type step is shown for ALL pricing models (Interior/Exterior selection)
        return (
          <JobTypeStep
            formData={formData}
            onUpdate={handleStepDataUpdate}
            onNext={handleNext}
            onPrevious={handlePrevious}
            pricingSchemes={pricingSchemes}
          />
        );
      
      case 2:
        // For turnkey: Home Size (step 2), for flat rate: Flat Rate Items (step 2), for others: Areas (step 2)
        if (isTurnkeyPricing()) {
          return (
            <HomeSizeStep
              key={`homesize-${formData.pricingSchemeId}`}
              formData={formData}
              setFormData={setFormData}
              onNext={handleNext}
              onPrevious={handlePrevious}
              pricingSchemes={pricingSchemes}
            />
          );
        } else if (usesUnitCounts()) {
          // Flat Rate Pricing Step
          return (
            <FlatRatePricingStep
              key={`flatrate-${formData.pricingSchemeId}-${formData.jobType}`}
              formData={{
                ...formData,
                pricingModelType: getPricingModelType(),
                pricingModelFriendlyName: getPricingModelFriendlyName(),
                pricingModelDescription: getPricingModelDescription(),
                contractorSettings: contractorSettings
              }}
              onUpdate={handleStepDataUpdate}
              onNext={handleNext}
              onPrevious={handlePrevious}
            />
          );
        } else {
          // Use ExteriorAreasStep for exterior jobs, AreasStepEnhanced for interior
          const enhancedFormData = {
            ...formData,
            pricingModelType: getPricingModelType(),
            pricingModelFriendlyName: getPricingModelFriendlyName(),
            pricingModelDescription: getPricingModelDescription(),
            contractorSettings: contractorSettings // Ensure contractor settings are passed
          };
          
          return formData.jobType === 'exterior' ? (
            <ExteriorAreasStep
              key={`exterior-${formData.pricingSchemeId}-${formData.jobType}-${formData._laborDataUpdated || 0}`}
              formData={enhancedFormData}
              onUpdate={handleStepDataUpdate}
              onNext={handleNext}
              onPrevious={handlePrevious}
            />
          ) : (
            <AreasStepEnhanced
              key={`areas-${formData.pricingSchemeId}-${formData.jobType}-${formData._laborDataUpdated || 0}`}
              formData={enhancedFormData}
              onUpdate={handleStepDataUpdate}
              onNext={handleNext}
              onPrevious={handlePrevious}
            />
          );
        }
      
      case 3:
        // Products (step 3) - shown for all pricing models
        return (
          <ProductsStep
            key={`products-${formData.pricingSchemeId}`}
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
      
      case 4:
        // Step 4: Either Tier Selection (if GBB enabled) or Summary (if GBB disabled)
        if (gbbEnabled && tierPricing) {
          return (
            <TierSelectionStep
              key={`tier-selection-${formData.pricingSchemeId}`}
              tierPricing={tierPricing}
              selectedTier={formData.gbbSelectedTier}
              onSelectTier={handleTierSelect}
              pricingScheme={getCurrentPricingScheme()}
            />
          );
        } else {
          // Summary (step 4) - when GBB is not enabled
          return (
            <SummaryStep
              key={`summary-${formData.pricingSchemeId}`}
              formData={formData}
              onUpdate={handleStepDataUpdate}
              onPrevious={handlePrevious}
              onEdit={handleEdit}
              pricingSchemes={pricingSchemes}
            />
          );
        }
      
      case 5:
        // Summary (step 5) - only shown when GBB is enabled
        return (
          <SummaryStep
            key={`summary-${formData.pricingSchemeId}`}
            formData={formData}
            onUpdate={handleStepDataUpdate}
            onPrevious={handlePrevious}
            onEdit={handleEdit}
            pricingSchemes={pricingSchemes}
            tierPricing={tierPricing}
            selectedTier={formData.gbbSelectedTier}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className={`${isMobile ? 'p-2' : 'p-4 md:p-6'}`}>
      <div className="max-w-5xl mx-auto">
        {/* Progress Header */}
        <div className={`${isMobile ? 'mb-4' : 'mb-8'}`}>
          <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} mb-4`}>
            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'} font-bold`}>
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
                size={isMobile ? 'small' : 'middle'}
              >
                {!isMobile && 'Refresh Settings'}
              </Button>
              <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500`}>
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
          </div>
          
          <Progress percent={progress} showInfo={false} className="mb-6" />
          
          {/* Step Indicators */}
          {!isMobile && (
            <Steps current={currentStep} className="hidden md:flex">
              {steps.map((step) => (
                <Steps.Step
                  key={step.id}
                  title={step.title}
                  icon={<step.icon />}
                />
              ))}
            </Steps>
          )}
        </div>

        {/* Step Content */}
        <Card>
          <div className={`${isMobile ? 'mb-4' : 'mb-6'}`}>
            <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold flex items-center gap-2`}>
              {(() => {
                const StepIcon = steps[currentStep].icon;
                return <StepIcon className="text-blue-500" />;
              })()}
              {steps[currentStep].title}
            </h3>
          </div>

          {renderStepContent()}
        </Card>

        {/* Auto-save indicator */}
        <div className={`text-center ${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 mt-4`}>
          Auto-saving every 30 seconds
          {formData.quoteId && ` • Draft ID: ${formData.quoteId}`}
          {autoSaveVersion > 1 && ` • Version: ${autoSaveVersion}`}
        </div>
      </div>

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        visible={conflictModalVisible}
        onCancel={handleConflictCancel}
        onResolve={handleConflictResolution}
        conflictData={conflictData}
      />
    </div>
  );
}

export default QuoteBuilderPage;
