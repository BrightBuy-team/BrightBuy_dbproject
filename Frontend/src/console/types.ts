// Matches the backend's inventory Variant record.
export type Variant = {
  variantId: number
  productId: number
  productName: string
  sku: string
  warehouseId: number
  variantName: string
  colour: string | null
  memorySize: string | null
  price: number
  stockQuantity: number
}

/** Variants with fewer units than this are listed as low stock. */
export const lowStockThreshold = 10
