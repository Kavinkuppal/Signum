import axios from 'axios'
import type { ProductFilters, ProductsResponse } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
}
