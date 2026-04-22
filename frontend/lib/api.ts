import axios from 'axios'
import type { ProductFilters, ProductsResponse } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const apiUrl = (path: string) => `${BASE_URL}/api/v1${path}`

export const authHeaders = (email: string | null | undefined, extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  ...(email ? { 'X-User-Email': email } : {}),
  ...extra,
})

const client = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  withCredentials: true,
})

export const api = {
  async getProducts(params: { search?: string } & ProductFilters): Promise<ProductsResponse> {
    const { data } = await client.get('/products', { params })
    return data
  },

  async getProduct(id: string) {
    const { data } = await client.get(`/products/${id}`)
    return data
  },

  async connectSupplier(supplierId: string) {
    const { data } = await client.post('/suppliers/connect', { supplier_id: supplierId })
    return data
  },

  async getSupplierConnections() {
    const { data } = await client.get('/suppliers/connections')
    return data
  },

  async refreshSupplier(supplierId: string) {
    const { data } = await client.post(`/suppliers/${supplierId}/refresh`)
    return data
  },

  async compareProducts(params: { search: string; material_category?: string }) {
    const { data } = await client.get('/products/compare', { params })
    return data
  },

  async interpretSearch(query: string) {
    const { data } = await client.post('/ai/interpret-search', { query })
    return data as {
      search: string | null
      material_category: string | null
      brand: string | null
      color: string | null
      finish: string | null
      in_stock: boolean | null
      interpreted: string
    }
  },

  async parseBOM(description: string) {
    const { data } = await client.post('/ai/parse-bom', { description })
    return data as {
      materials: { material_name: string; quantity: number; unit: string }[]
      summary: string
    }
  },
}
