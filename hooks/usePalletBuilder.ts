'use client'

import { useState, useEffect, useCallback } from 'react'
import { warehouseFeedback } from '@/lib/warehouse-ui-utils'
import { useToast } from '@/hooks/use-toast'

export interface OrderItem {
  sku: string
  name: string
  quantity: number
  weight?: { value: number; units: string }
  dimensions?: { length: number; width: number; height: number; units: string }
}

export interface Pallet {
  id: string
  type: '48x48' | '48x40' | 'custom'
  dimensions: {
    length: number
    width: number
    height: number
    units: 'in' | 'cm'
  }
  weight: {
    value: number
    units: 'lbs' | 'kg'
  }
  items: Array<{
    sku: string
    name: string
    quantity: number
    position?: { x: number; y: number; z: number }
  }>
  stackable: boolean
  notes?: string
}

export const STANDARD_PALLETS = {
  '48x48': { length: 48, width: 48, maxHeight: 72 },
  '48x40': { length: 48, width: 40, maxHeight: 72 },
  'custom': { length: 0, width: 0, maxHeight: 96 }
}

export const MAX_PALLET_WEIGHT_LBS = 4000

interface UsePalletBuilderProps {
  orderItems: OrderItem[]
  existingPallets?: Pallet[]
  onChange?: (pallets: Pallet[]) => void
}

export function usePalletBuilder({
  orderItems,
  existingPallets = [],
  onChange
}: UsePalletBuilderProps) {
  const { toast } = useToast()
  const [pallets, setPallets] = useState<Pallet[]>(existingPallets.length > 0 ? existingPallets : [])
  const [unassignedItems, setUnassignedItems] = useState<OrderItem[]>([])
  const [selectedPallet, setSelectedPallet] = useState<string | null>(null)
  const [draggedItem, setDraggedItem] = useState<OrderItem | null>(null)
  const [showDimensionInput, setShowDimensionInput] = useState<string | null>(null)

  const updatePalletState = useCallback((updater: (current: Pallet[]) => Pallet[]) => {
    setPallets(prev => {
      const next = updater(prev)
      onChange?.(next)
      return next
    })
  }, [onChange])

  // Initialize unassigned items
  useEffect(() => {
    if (pallets.length === 0) {
      setUnassignedItems(orderItems)
    } else {
      // Calculate remaining unassigned items
      const assignedSkus = new Map<string, number>()
      pallets.forEach(pallet => {
        pallet.items.forEach(item => {
          const current = assignedSkus.get(item.sku) || 0
          assignedSkus.set(item.sku, current + item.quantity)
        })
      })

      const remaining = orderItems.map(item => {
        const assigned = assignedSkus.get(item.sku) || 0
        const remainingQty = item.quantity - assigned
        return remainingQty > 0 ? { ...item, quantity: remainingQty } : null
      }).filter(Boolean) as OrderItem[]

      setUnassignedItems(remaining)
    }
  }, [pallets, orderItems])

  const createNewPallet = (type: '48x48' | '48x40' | 'custom' = '48x48') => {
    warehouseFeedback.success()
    const standardDims = STANDARD_PALLETS[type]
    const newPallet: Pallet = {
      id: `pallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      dimensions: {
        length: standardDims.length,
        width: standardDims.width,
        height: 0, // Will be calculated based on items
        units: 'in'
      },
      weight: {
        value: 0,
        units: 'lbs'
      },
      items: [],
      stackable: true
    }
    updatePalletState(prev => [...prev, newPallet])
    setSelectedPallet(newPallet.id)
  }

  const deletePallet = (palletId: string) => {
    warehouseFeedback.warning()
    const pallet = pallets.find(p => p.id === palletId)
    if (pallet && pallet.items.length > 0) {
      // Return items to unassigned
      const itemsToReturn = pallet.items.map(item => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        weight: orderItems.find(oi => oi.sku === item.sku)?.weight,
        dimensions: orderItems.find(oi => oi.sku === item.sku)?.dimensions
      }))
      setUnassignedItems(prev => [...prev, ...itemsToReturn])
    }
    updatePalletState(prev => prev.filter(p => p.id !== palletId))
    if (selectedPallet === palletId) {
      setSelectedPallet(null)
    }
  }

  const handleItemDrop = (palletId: string, item: OrderItem, quantity?: number) => {
    warehouseFeedback.success()
    updatePalletState(prev => {
      const pallet = prev.find(p => p.id === palletId)
      if (!pallet) return prev

      const next = prev.map(p => ({ ...p, items: [...p.items], weight: { ...p.weight }, dimensions: { ...p.dimensions } }))
      const target = next.find(p => p.id === palletId)
      if (!target) return prev

      const qtyToAdd = quantity || item.quantity

      const itemWeight = (item.weight?.value || 0) * qtyToAdd
      const newTotalWeight = target.weight.value + itemWeight

      if (newTotalWeight > MAX_PALLET_WEIGHT_LBS) {
        warehouseFeedback.error()
        toast({
          title: "Error",
          description: `Adding this item would exceed the ${MAX_PALLET_WEIGHT_LBS} lbs pallet weight limit`,
          variant: "destructive"
        })
        return prev
      }

      const existingItem = target.items.find(i => i.sku === item.sku)
      if (existingItem) {
        existingItem.quantity += qtyToAdd
      } else {
        target.items.push({
          sku: item.sku,
          name: item.name,
          quantity: qtyToAdd
        })
      }

      target.weight.value = newTotalWeight

      const estimatedHeight = Math.min(
        target.items.length * 12,
        STANDARD_PALLETS[target.type].maxHeight
      )
      target.dimensions.height = estimatedHeight

      return next
    })

    const remainingQty = item.quantity - (quantity || item.quantity)
    if (remainingQty > 0) {
      setUnassignedItems(prev => prev.map(ui =>
        ui.sku === item.sku ? { ...ui, quantity: remainingQty } : ui
      ))
    } else {
      setUnassignedItems(prev => prev.filter(ui => ui.sku !== item.sku))
    }
  }

  const removeItemFromPallet = (palletId: string, itemSku: string) => {
    warehouseFeedback.warning()
    const pallet = pallets.find(p => p.id === palletId)
    if (!pallet) return

    const item = pallet.items.find(i => i.sku === itemSku)
    if (!item) return

    const orderItem = orderItems.find(oi => oi.sku === itemSku)
    if (orderItem) {
      setUnassignedItems(prev => {
        const existing = prev.find(ui => ui.sku === itemSku)
        if (existing) {
          return prev.map(ui =>
            ui.sku === itemSku ? { ...ui, quantity: ui.quantity + item.quantity } : ui
          )
        }
        return [...prev, { ...orderItem, quantity: item.quantity }]
      })
    }

    updatePalletState(prev => prev.map(p => {
      if (p.id !== palletId) return p
      const remainingItems = p.items.filter(i => i.sku !== itemSku)
      const recalculatedWeight = remainingItems.reduce((sum, i) => {
        const oi = orderItems.find(o => o.sku === i.sku)
        return sum + ((oi?.weight?.value || 0) * i.quantity)
      }, 0)
      return {
        ...p,
        items: remainingItems,
        weight: { ...p.weight, value: recalculatedWeight }
      }
    }))
  }

  const updatePalletDimensions = (palletId: string, dims: Partial<Pallet['dimensions']>) => {
    updatePalletState(prev => prev.map(p =>
      p.id === palletId
        ? { ...p, dimensions: { ...p.dimensions, ...dims } }
        : p
    ))
    setShowDimensionInput(null)
  }

  const getTotalWeight = () => {
    return pallets.reduce((sum, p) => sum + p.weight.value, 0)
  }

  const getWeightWarning = (weight: number): 'danger' | 'warning' | 'success' => {
    if (weight > MAX_PALLET_WEIGHT_LBS) return 'danger'
    if (weight > MAX_PALLET_WEIGHT_LBS * 0.8) return 'warning'
    return 'success'
  }

  return {
    // State
    pallets,
    unassignedItems,
    selectedPallet,
    draggedItem,
    showDimensionInput,
    
    // Setters
    setSelectedPallet,
    setDraggedItem,
    setShowDimensionInput,
    
    // Actions
    createNewPallet,
    deletePallet,
    handleItemDrop,
    removeItemFromPallet,
    updatePalletDimensions,

    // Helpers
    getTotalWeight,
    getWeightWarning
  }
}
