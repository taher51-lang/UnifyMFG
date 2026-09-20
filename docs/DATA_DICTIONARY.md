# Data Dictionary

## `products`
| Column | Type | Description |
|---|---|---|
| id | UUID | Primary Key |
| name | TEXT | Product Name |
| cost_price | NUMERIC | Calculated BOM Cost |
| wholesale_price | NUMERIC | B2B Price |
| packaging_size | NUMERIC | Size of package (e.g. 25) |
| selling_unit | TEXT | e.g. kg, L |

## `stock_ledger`
| Column | Type | Description |
|---|---|---|
| change_amount | NUMERIC | Delta (+ or -) |
| new_stock_qty | NUMERIC | Balance after change |
