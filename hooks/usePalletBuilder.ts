'use client'

import { useState, useEffect } from 'react'
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
  onSave: (pallets: Pallet[]) => Promise<void>
}

export function usePalletBuilder({
  orderItems,
  existingPallets = [],
  onSave
}: UsePalletBuilderProps) {
  const { toast } = useToast()
  const [pallets, setPallets] = useState<Pallet[]>(existingPallets.length > 0 ? existingPallets : [])
  const [unassignedItems, setUnassignedItems] = useState<OrderItem[]>([])
  const [selectedPallet, setSelectedPallet] = useState<string | null>(null)
  const [draggedItem, setDraggedItem] = useState<OrderItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDimensionInput, setShowDimensionInput] = useState<string | null>(null)

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
    setPallets([...pallets, newPallet])
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
      setUnassignedItems([...unassignedItems, ...itemsToReturn])
    }
    setPallets(pallets.filter(p => p.id !== palletId))
    if (selectedPallet === palletId) {
      setSelectedPallet(null)
    }
  }

  const handleItemDrop = (palletId: string, item: OrderItem, quantity?: number) => {
    warehouseFeedback.success()
    const pallet = pallets.find(p => p.id === palletId)
    if (!pallet) return

    const qtyToAdd = quantity || item.quantity
    
    // Check weight limit
    const itemWeight = (item.weight?.value || 0) * qtyToAdd
    const newTotalWeight = pallet.weight.value + itemWeight
    
    if (newTotalWeight > MAX_PALLET_WEIGHT_LBS) {
      warehouseFeedback.error()
      toast({
        title: "Error",
        description: `Adding this item would exceed the ${MAX_PALLET_WEIGHT_LBS} lbs pallet weight limit`,
        variant: "destructive"
      })
      return
    }

    // Add item to pallet
    const existingItem = pallet.items.find(i => i.sku === item.sku)
    if (existingItem) {
      existingItem.quantity += qtyToAdd
    } else {
      pallet.items.push({
        sku: item.sku,
        name: item.name,
        quantity: qtyToAdd
      })
    }

    // Update pallet weight and dimensions
    pallet.weight.value = newTotalWeight
    
    // Estimate height based on items (simplified calculation)
    const estimatedHeight = Math.min(
      pallet.items.length * 12, // Rough estimate: 12 inches per layer
      STANDARD_PALLETS[pallet.type].maxHeight
    )
    pallet.dimensions.height = estimatedHeight

    // Remove from unassigned
    const remainingQty = item.quantity - qtyToAdd
    if (remainingQty > 0) {
      setUnassignedItems(unassignedItems.map(ui => 
        ui.sku === item.sku ? { ...ui, quantity: remainingQty } : ui
      ))
    } else {
      setUnassignedItems(unassignedItems.filter(ui => ui.sku !== item.sku))
    }

    setPallets([...pallets])
  }

  const removeItemFromPallet = (palletId: string, itemSku: string) => {
    warehouseFeedback.warning()
    const pallet = pallets.find(p => p.id === palletId)
    if (!pallet) return

    const item = pallet.items.find(i => i.sku === itemSku)
    if (!item) return

    // Return to unassigned
    const orderItem = orderItems.find(oi => oi.sku === itemSku)
    if (orderItem) {
      const existing = unassignedItems.find(ui => ui.sku === itemSku)
      if (existing) {
        existing.quantity += item.quantity
        setUnassignedItems([...unassignedItems])
      } else {
        setUnassignedItems([...unassignedItems, { ...orderItem, quantity: item.quantity }])
      }
    }

    // Remove from pallet
    pallet.items = pallet.items.filter(i => i.sku !== itemSku)
    
    // Recalculate weight
    pallet.weight.value = pallet.items.reduce((sum, i) => {
      const oi = orderItems.find(o => o.sku === i.sku)
      return sum + ((oi?.weight?.value || 0) * i.quantity)
    }, 0)

    setPallets([...pallets])
  }

  const updatePalletDimensions = (palletId: string, dims: Partial<Pallet['dimensions']>) => {
    setPallets(pallets.map(p => 
      p.id === palletId 
        ? { ...p, dimensions: { ...p.dimensions, ...dims } }
        : p
    ))
    setShowDimensionInput(null)
  }

  const handleSave = async () => {
    setSaving(true)
    warehouseFeedback.success()
    
    try {
      await onSave(pallets)
    } catch (error) {
      console.error('Error saving pallet arrangement:', error)
      warehouseFeedback.error()
    } finally {
      setSaving(false)
    }
  }

  const getTotalWeight = () => {
    return pallets.reduce((sum, p) => sum + p.weight.value, 0)
  }

  const getWeightWarning = (weight: number) => {
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
    saving,
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
    handleSave,
    
    // Helpers
    getTotalWeight,
    getWeightWarning
  }
}