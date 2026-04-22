export interface Product {
  id: string
  supplier_name: string
  sku: string
  title: string
  brand: string | null
  material_category: string | null
  dimensions_length: number | null
  dimensions_width: number | null
  dimensions_thickness: number | null
  color: string | null
  finish: string | null
  price: number
  normalized_price: number | null
  normalized_unit: string | null
  pack_quantity: number | null
  in_stock: boolean
  lead_time_days: number | null
  product_url: string
  image_url: string | null
  description: string | null
  last_scraped_at: string
}

export interface ProductFilters {
  material_category?: string
  brand?: string
  min_price?: number
  max_price?: number
  in_stock?: boolean
  supplier?: string
}

export interface ProductsResponse {
  products: Product[]
  total: number
  page: number
  page_size: number
}

export interface SupplierConnection {
  id: string
  supplier_name: string
  connected_at: string
  last_synced_at: string | null
}

export interface CustomSupplier {
  id: string
  url: string
  domain: string
  name: string
  scrape_status: 'pending' | 'scraping' | 'scraped' | 'failed'
  scrape_error: string | null
  scrape_strategy: string | null
  products_found: number
  created_at: string
  last_scraped_at: string | null
}
