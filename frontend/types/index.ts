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

export interface UserProfile {
  id: string
  user_id: string
  zip_code: string | null
  city: string | null
  lat: number | null
  lng: number | null
  search_radius_km: number
  priority: 'price' | 'speed' | 'local'
  material_interests: string[] | null
  created_at: string
  updated_at: string
}

export interface LocalSupplier {
  id: string
  name: string
  address: string | null
  phone: string | null
  website: string | null
  lat: number | null
  lng: number | null
  distance_km: number | null
  material_categories: string[] | null
  scrape_status: 'pending' | 'scraping' | 'scraped' | 'failed' | 'no_website' | 'login_required'
  scrape_error: string | null
  products_found: number
  last_scraped_at: string | null
  rank_score: number | null
  discovered_at: string
  osm_id: string | null
  osm_type: string | null
  osm_tags: Record<string, string> | null
}
