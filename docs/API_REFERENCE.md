# API Reference

All requests to the backend must be prefixed with `/api` and include a valid Supabase JWT in the headers.

## Authentication
```http
Authorization: Bearer <SUPABASE_JWT_TOKEN>
```
If the token is invalid, missing, or expired, the backend will return a `401 Unauthorized`.

## 1. Inventory & Production

### Record Production Run
```http
POST /api/inventory/produce
```
**Body:**
```json
{
  "formulation_id": "uuid",
  "qty_produced": 10,
  "date": "2023-10-15"
}
```
**Action:** Consumes raw materials/sub-assemblies recursively according to the BOM and increments the stock of the resulting product.

### Record Loose Packing
```http
POST /api/inventory/pack-loose
```
**Body:**
```json
{
  "product_id": "uuid",
  "qty_packages": 5,
  "date": "2023-10-15"
}
```
**Action:** Adjusts packaging unit logic for bulk-to-retail flows.

## 2. Invoicing & Sales

### Create Invoice
```http
POST /api/invoices
```
**Body:**
```json
{
  "customer_id": "uuid",
  "items": [
    { "product_id": "uuid", "qty": 10, "unit_price": 150 }
  ],
  "discount_pct": 5,
  "gst_pct": 18
}
```
**Action:** Generates a draft invoice and calculates subtotals, tax, and totals automatically.

### Download Invoice PDF
```http
GET /api/invoices/<invoice_id>/pdf
```
**Returns:** `application/pdf` binary stream.

## 3. Formulations (BOM)

### Bulk Update Ingredients
```http
PUT /api/formulations/<id>/ingredients/bulk
```
**Body:**
```json
{
  "lines": [
    { "raw_material_id": "uuid", "qty_per_batch": 5.5 },
    { "product_id": "uuid", "qty_per_batch": 2.0 }
  ]
}
```
**Action:** Drops and recreates the BOM, then triggers a recursive cost recalculation up the chain to update the `cost_price` of all affected products.
