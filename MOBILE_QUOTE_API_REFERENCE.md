# Mobile Quote Builder API Reference
**Phase 2: Product Selection + Pricing + Booking**

This document describes the mobile app APIs for the customer-facing quote builder experience.

---

## Base URL

All mobile API endpoints are under:

```
/api/v1/mbl
```

### Sub-routes:
- `/api/v1/mbl/auth` - Authentication endpoints
- `/api/v1/mbl/quote` - Quote builder endpoints

---

## Overview

The mobile quote builder allows customers to:
1. **Select Job Type**: Choose interior or exterior painting
2. **Add Service Areas**: Define areas with dimensions and number of coats
3. **Select Products**: Choose from Good-Better-Best (GBB) or single product strategy
4. **Assign Products**: Apply products to all areas or select individually per area
5. **Choose Brand & Colors**: Select brand first, then view available colors
6. **Calculate Pricing**: Get complete cost breakdown with materials, labor, markup, and tax
7. **Create Quote**: Save draft quote with all selections
8. **Request Booking**: Select preferred dates and submit booking request

All mobile users are customers of **Bobby's Prime Choice Painting** (single tenant system).

---

## Authentication

All endpoints require authentication using JWT token:

```http
Authorization: Bearer <jwt_token>
```

Get JWT token from mobile auth endpoints (`/api/v1/mbl/auth/signin`).

---

## Rate Limiting

- **30 requests per 15 minutes** per IP address
- Returns `429 Too Many Requests` if exceeded

---

## Endpoints

### 1. Get Pricing Schemes

**GET** `/api/v1/mbl/quote/pricing-schemes`

Get available pricing schemes for the user to select.

#### Example Request

```http
GET /api/v1/mbl/quote/pricing-schemes
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Example Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Standard Residential",
      "description": "Standard pricing for residential projects",
      "isDefault": true
    },
    {
      "id": 2,
      "name": "Commercial",
      "description": "Pricing for commercial projects",
      "isDefault": false
    }
  ],
  "total": 2
}
```

---

### 2. Get Brands

**GET** `/api/v1/mbl/quote/brands`

Get available brands for color selection.

#### Example Request

```http
GET /api/v1/mbl/quote/brands
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Example Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Sherwin-Williams",
      "description": "Premium paint manufacturer"
    },
    {
      "id": 2,
      "name": "Benjamin Moore",
      "description": "High-quality paints and coatings"
    }
  ],
  "total": 2
}
```

---

### 3. Get Products for Areas (GBB Strategy)



**POST** `/api/v1/mbl/quote/products-for-areas`

Get products based on service areas and job type. Returns products grouped by surface type using Good-Better-Best (GBB) strategy or Single Product strategy.

#### Request Body

```json
{
  "jobType": "interior",
  "areas": [
    {
      "name": "Living Room",
      "surfaces": [
        {
          "type": "walls",
          "width": 240,
          "height": 8,
          "measurementUnit": "linear_foot"
        }
      ],
      "numberOfCoats": 2
    },
    {
      "name": "Master Bedroom",
      "surfaces": [
        {
          "type": "walls",
          "width": 180,
          "height": 8,
          "measurementUnit": "linear_foot"
        },
        {
          "type": "ceiling",
          "width": 15,
          "height": 12,
          "measurementUnit": "dimensions"
        }
      ],
      "numberOfCoats": 2
    }
  ],
  "productStrategy": "GBB",
  "pricingSchemeId": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobType` | string | Yes | `interior` or `exterior` |
| `areas` | array | Yes | Array of areas with surfaces and measurements |
| `productStrategy` | string | No | `GBB` (default) or `Single` |
| `pricingSchemeId` | integer | No | Pricing scheme ID |

#### Example Response (GBB Strategy)

```json
{
  "success": true,
  "data": {
    "jobType": "interior",
    "productStrategy": "GBB",
    "surfaceTypes": ["walls", "ceiling"],
    "productRecommendations": {
      "walls": {
        "surfaceType": "walls",
        "strategy": "GBB",
        "good": {
          "id": 41,
          "name": "ProMar 200 Interior Latex",
          "brand": "Sherwin-Williams",
          "tier": "Good",
          "coverage": 350,
          "availableSheens": [
            {
              "name": "Flat",
              "price": 24.99,
              "coverage": 350
            },
            {
              "name": "Eggshell",
              "price": 25.99,
              "coverage": 350
            }
          ],
          "pricing": {
            "discountedPrice": "24.99",
            "retailPrice": "34.99",
            "yourSavings": "10.00",
            "savingsPercent": "29%"
          }
        },
        "better": {
          "id": 42,
          "name": "Cashmere Interior Acrylic Latex",
          "brand": "Sherwin-Williams",
          "tier": "Better",
          "pricing": {
            "discountedPrice": "32.99",
            "retailPrice": "46.19",
            "yourSavings": "13.20",
            "savingsPercent": "29%"
          }
        },
        "best": {
          "id": 43,
          "name": "Emerald Interior Acrylic Latex",
          "brand": "Sherwin-Williams",
          "tier": "Best",
          "pricing": {
            "discountedPrice": "45.99",
            "retailPrice": "64.39",
            "yourSavings": "18.40",
            "savingsPercent": "29%"
          }
        },
        "allGoodProducts": [...],
        "allBetterProducts": [...],
        "allBestProducts": [...]
      },
      "ceiling": {
        "surfaceType": "ceiling",
        "strategy": "GBB",
        "good": {...},
        "better": {...},
        "best": {...}
      }
    }
  }
}
```



### 4. Get Colors by Brand

**GET** `/api/v1/mbl/quote/colors-by-brand/:brandId`

Get available colors for a specific brand.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Search by color name or code |
| `limit` | integer | No | Max results (default: 100) |

#### Example Request

```http
GET /api/v1/mbl/quote/colors-by-brand/1?search=white&limit=50
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Example Response

```json
{
  "success": true,
  "data": {
    "brandId": 1,
    "brandName": "Sherwin-Williams",
    "colors": [
      {
        "id": 245,
        "name": "Pure White",
        "code": "SW-7005",
        "hexValue": "#FFFFFF",
        "rgb": {
          "r": 255,
          "g": 255,
          "b": 255
        },
        "sampleImage": "https://example.com/colors/sw-7005.jpg"
      },
      {
        "id": 246,
        "name": "Alabaster",
        "code": "SW-7008",
        "hexValue": "#F2F0E6",
        "rgb": {
          "r": 242,
          "g": 240,
          "b": 230
        },
        "sampleImage": "https://example.com/colors/sw-7008.jpg"
      },
      {
        "id": 247,
        "name": "Agreeable Gray",
        "code": "SW-7029",
        "hexValue": "#D1CBC1",
        "rgb": {
          "r": 209,
          "g": 203,
          "b": 193
        },
        "sampleImage": "https://example.com/colors/sw-7029.jpg"
      }
    ],
    "total": 48
  }
}
```

---

### 5. Calculate Pricing

**POST** `/api/v1/mbl/quote/calculate-pricing`

Calculate complete pricing breakdown with materials, labor, markup, tax, and deposit. Returns detailed cost breakdown per area.

#### Request Body

```json
{
  "areas": [
    {
      "name": "Living Room",
      "surfaces": [
        {
          "type": "walls",
          "width": 240,
          "height": 8,
          "length": 240,
          "measurementUnit": "linear_foot"
        }
      ],
      "productId": 42,
      "sheenName": "Eggshell",
      "numberOfCoats": 2,
      "colorName": "Alabaster",
      "colorCode": "SW-7008"
    },
    {
      "name": "Bedroom 1",
      "surfaces": [
        {
          "type": "walls",
          "width": 180,
          "height": 8,
          "length": 180,
          "measurementUnit": "linear_foot"
        }
      ],
      "productId": 42,
      "sheenName": "Eggshell",
      "numberOfCoats": 2,
      "colorName": "Pure White",
      "colorCode": "SW-7005"
    }
  ],
  "pricingSchemeId": 1,
  "useContractorDiscount": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `areas` | array | Yes | Areas with surfaces, products, and colors |
| `pricingSchemeId` | integer | No | Pricing scheme to use |
| `useContractorDiscount` | boolean | No | Use discount-only option |

#### Example Response

```json
{
  "success": true,
  "data": {
    "areaBreakdown": [
      {
        "area": "Living Room",
        "product": "Cashmere Interior Acrylic Latex",
        "brand": "Sherwin-Williams",
        "sheen": "Eggshell",
        "color": "Alabaster",
        "colorCode": "SW-7008",
        "squareFeet": "1920.00",
        "surfaces": [
          {
            "type": "walls",
            "sqft": "1920.00",
            "dimensions": "240' L × 8' H"
          }
        ],
        "gallonsNeeded": "10.97",
        "pricePerGallon": "32.99",
        "materialCost": "361.90",
        "laborCost": "5760.00",
        "numberOfCoats": 2,
        "totalCostForArea": "6121.90"
      },
      {
        "area": "Bedroom 1",
        "product": "Cashmere Interior Acrylic Latex",
        "brand": "Sherwin-Williams",
        "sheen": "Eggshell",
        "color": "Pure White",
        "colorCode": "SW-7005",
        "squareFeet": "1440.00",
        "surfaces": [
          {
            "type": "walls",
            "sqft": "1440.00",
            "dimensions": "180' L × 8' H"
          }
        ],
        "gallonsNeeded": "8.23",
        "pricePerGallon": "32.99",
        "materialCost": "271.43",
        "laborCost": "4320.00",
        "numberOfCoats": 2,
        "totalCostForArea": "4591.43"
      }
    ],
    "summary": {
      "totalSquareFeet": "3360.00",
      "totalGallons": "19.20",
      "totalAreas": 2,
      
      "materialCostWithDiscount": "633.33",
      "materialCostRetail": "886.66",
      "materialSavings": "253.33",
      "savingsPercent": "29%",
      
      "laborCost": "10080.00",
      
      "contractorDiscountFee": "95.00",
      "totalIfDiscountOnly": "728.33",
      
      "markup": "158.33",
      "markupPercent": "25.00%",
      "subtotalBeforeTax": "791.66",
      "tax": "65.31",
      "taxPercent": "8.25%",
      "fullJobTotal": "10937.30",
      
      "depositRequired": "5468.65",
      "depositPercent": "50%",
      "remainingBalance": "5468.65",
      
      "youSave": "253.33",
      "recommendedOption": "fullJob"
    },
    "paymentSchedule": {
      "deposit": {
        "amount": "5468.65",
        "percentage": 50,
        "dueAt": "Upon approval"
      },
      "finalPayment": {
        "amount": "5468.65",
        "percentage": 50,
        "dueAt": "Upon completion"
      }
    }
  }
}
```

#### Pricing Breakdown Explained

**Per Area Details:**
- Surface type and square footage
- Gallons needed based on coverage (350 sqft/gal default)
- Material cost (gallons × price per gallon)
- Labor cost (sqft × labor rate × coats)
- Total cost for the area

**Summary Totals:**
- **Material Cost**: With contractor discount
- **Retail Price**: What customer would pay at retail
- **Savings**: Discount amount saved
- **Labor Cost**: Total labor for all areas
- **Markup**: Contractor markup on materials (25% default)
- **Tax**: Sales tax on materials + markup (8.25% default)
- **Deposit**: Required upfront payment (50% default)

**Two Pricing Options:**
1. **Discount Only**: Pay 15% fee, buy materials yourself ($728.33)
2. **Full Job**: Materials + labor + markup + tax ($10,937.30)



## Error Responses

All endpoints return error responses in this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (dev mode only)"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad Request (invalid parameters) |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (not quote owner) |
| `404` | Not Found (quote/product not found) |
| `429` | Too Many Requests (rate limit exceeded) |
| `500` | Internal Server Error |

---

## Mobile App Flow

### Complete User Journey

1. **Authentication** (existing auth APIs)
   ```
   POST /api/v1/mbl/auth/signin
   ```
   - User signs in with email/password or social login
   - Receives JWT token

2. **Select Job Type**
   - User selects Interior or Exterior in the app
   - No API call needed (local state)

3. **Add Service Areas**
   - User scans or manually enters areas with dimensions
   - Local state: area name, surfaces, dimensions, coats
   - No API call until ready to get products

4. **Get Pricing Schemes** (Optional)
   ```
   GET /api/v1/mbl/quote/pricing-schemes
   ```
   - User can select a pricing scheme
   - Defaults to standard scheme

5. **Get Products for Areas** (GBB Strategy)
   ```
   POST /api/v1/mbl/quote/products-for-areas
   ```
   - Send jobType and areas
   - Receive Good-Better-Best products per surface type
   - User sees price comparison with savings

6. **Select Products**
   - User selects Good, Better, or Best tier
   - Can apply same product to all areas or select individually
   
7. **Assign Products**
   ```
   POST /api/v1/mbl/quote/assign-products
   ```
   - Send product selections
   - Receive updated areas with product assignments

8. **Get Brands**
   ```
   GET /api/v1/mbl/quote/brands
   ```
   - User selects brand for color selection

9. **Get Colors by Brand**
   ```
   GET /api/v1/mbl/quote/colors-by-brand/:brandId
   ```
   - Browse colors grouped by color family
   - Search for specific colors

10. **Select Colors**
    - User assigns colors to each area
    - Local state tracking

11. **Assign Colors**
    ```
    POST /api/v1/mbl/quote/assign-colors
    ```
    - After creating draft quote
    - Updates quote with color selections

12. **Calculate Pricing**
    ```
    POST /api/v1/mbl/quote/calculate-pricing
    ```
    - Get complete cost breakdown
    - See per-area details
    - View payment schedule
    - Compare discount-only vs full job

13. **Create Draft Quote**
    ```
    POST /api/v1/mbl/quote/create-draft
    ```
    - Save quote to database
    - Generate quote number

14. **Request Booking**
    ```
    POST /api/v1/mbl/quote/request-booking
    ```
    - Select preferred dates
    - Add special instructions
    - Submit booking request

15. **Track Status**
    ```
    GET /api/v1/mbl/quote/my-quotes
    GET /api/v1/mbl/quote/:id
    ```
    - View all quotes
    - Check booking status
    - See approval status

### Flow Diagram

```
┌─────────────────────┐
│  1. Sign In         │
│  /mbl/auth/signin   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  2. Select Job Type │
│  (Interior/Exterior)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  3. Add Areas       │
│  (Scan/Manual Entry)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│  4. Get Products for Areas  │
│  POST /products-for-areas   │
│  (GBB Strategy)             │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────┐
│  5. Select Products │
│  (Good/Better/Best) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  6. Assign Products │
│  POST /assign-      │
│       products      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  7. Get Brands      │
│  GET /brands        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│  8. Get Colors by Brand │
│  GET /colors-by-brand/:id│
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────┐
│  9. Calculate Price │
│  POST /calculate-   │
│       pricing       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 10. Create Draft    │
│  POST /create-draft │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 11. Assign Colors   │
│  POST /assign-colors│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 12. Request Booking │
│  POST /request-     │
│        booking      │
└─────────────────────┘
```

---

## Business Logic

### Contractor Discount System

**Retail Price Calculation:**
- Contractor gets products at `discountedPrice`
- Retail price = `discountedPrice × 1.4` (40% markup)
- Customer savings = `retailPrice - discountedPrice`

**Use-My-Discount Fee:**
- Fee = `15% of materialCost`
- Customer buys materials themselves
- No labor included
- Total = `materialCost + fee`

**Full Job Pricing:**
- Material cost at contractor discount
- Labor cost: `$1.50/sqft × numberOfCoats` (configurable)
- Markup: `25%` on materials (configurable)
- Tax: `8.25%` on materials + markup (configurable)
- Total = `materialCost + markup + tax + laborCost`

### Coverage Calculation

```javascript
gallonsNeeded = (squareFeet / coverage) × numberOfCoats
```

Default coverage: **350 sqft per gallon**

### Labor Rate Calculation

```javascript
laborCost = squareFeet × laborRate × numberOfCoats
```

Default labor rate: **$1.50 per sqft** (walls)

---

## Bobby's Tenant System

All mobile users are automatically associated with:

- **Tenant**: Bobby's Prime Choice Painting
- **Email**: bobby@primechoicepainting.com
- **Location**: Austin, TX
- **Subscription**: Enterprise Plan

This ensures all mobile customers see Bobby's products, pricing, and availability.

---

## Next Steps (Future)

- **Payment Integration**: Deposit payment via Stripe
- **Booking Confirmation**: Automated email notifications
- **Calendar Integration**: Real-time contractor availability
- **Photo Upload**: Before/after job photos
- **Review System**: Customer reviews and ratings

---

## Support

For API issues or questions:
- Email: support@primechoicepainting.com
- Phone: (512) XXX-XXXX
