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

  async getDiscoveryStatus(email: string) {
    const { data } = await client.get('/local-suppliers/status', {
      headers: { 'X-User-Email': email },
    })
    return data
  },

  async getLocalSuppliers(email: string) {
    const { data } = await client.get('/local-suppliers', {
      headers: { 'X-User-Email': email },
    })
    return data
  },

  async getLocationProfile(email: string) {
    const { data } = await client.get('/local-suppliers/profile', {
      headers: { 'X-User-Email': email },
    })
    return data
  },

  async saveLocationProfile(email: string, payload: {
    zip_code?: string
    city?: string
    search_radius_km: number
    priority: string
    material_interests: string[]
  }) {
    const { data } = await client.post('/local-suppliers/profile', payload, {
      headers: { 'X-User-Email': email },
    })
    return data
  },

  async discoverLocalSuppliers(email: string, useAi: boolean = false) {
    const { data } = await client.post(
      `/local-suppliers/discover?use_ai=${useAi}`,
      {},
      { headers: { 'X-User-Email': email } },
    )
    return data
  },

  async rescrapeLocalSupplier(email: string, supplierId: string) {
    const { data } = await client.post(`/local-suppliers/${supplierId}/scrape`, {}, {
      headers: { 'X-User-Email': email },
    })
    return data
  },
}
