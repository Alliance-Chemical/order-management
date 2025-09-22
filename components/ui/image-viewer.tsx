'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImageViewerProps {
  src: string
  alt: string
  className?: string
  title?: string
  subtitle?: string
  children?: React.ReactNode
}

export function ImageViewer({
  src,
  alt,
  className = '',
  title,
  subtitle,
  children
}: ImageViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleReset = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale > 1 && e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && scale > 1 && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      })
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  const handleDoubleClick = () => {
    if (scale === 1) {
      setScale(2)
    } else {
      handleReset()
    }
  }

  return (
    <>
      {children ? (
        <div
          onClick={() => setIsOpen(true)}
          className="cursor-pointer"
        >
          {children}
        </div>
      ) : (
        <div className="relative group cursor-pointer" onClick={() => setIsOpen(true)}>
          <img
            src={src}
            alt={alt}
            className={`${className} transition-opacity group-hover:opacity-90`}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-black/70 text-white px-3 py-2 rounded-lg flex items-center gap-2">
              <Maximize2 className="h-5 w-5" />
              <span className="text-sm font-medium">Tap to enlarge</span>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-full h-screen p-0 bg-black/95">
          <div className="relative h-full flex flex-col">
            {/* Header with close button */}
            <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
              <div className="flex items-start justify-between">
                <div className="text-white">
                  {title && <h2 className="text-xl font-bold">{title}</h2>}
                  {subtitle && <p className="text-sm text-gray-300 mt-1">{subtitle}</p>}
                </div>
                <Button
                  onClick={() => {
                    setIsOpen(false)
                    handleReset()
                  }}
                  size="lg"
                  variant="ghost"
                  className="text-white hover:bg-white/20 min-w-[60px] min-h-[60px]"
                >
                  <X className="h-8 w-8" />
                </Button>
              </div>
            </div>

            {/* Image container */}
            <div
              className="flex-1 flex items-center justify-center overflow-hidden relative"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onDoubleClick={handleDoubleClick}
              style={{ cursor: scale > 1 ? 'move' : 'default' }}
            >
              <img
                src={src}
                alt={alt}
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                  transition: isDragging ? 'none' : 'transform 0.2s'
                }}
                draggable={false}
              />
            </div>

            {/* Zoom controls */}
            <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-center gap-2">
                <Button
                  onClick={handleZoomOut}
                  size="lg"
                  variant="secondary"
                  className="min-w-[60px] min-h-[60px]"
                  disabled={scale <= 0.5}
                >
                  <ZoomOut className="h-6 w-6" />
                </Button>
                <Button
                  onClick={handleReset}
                  size="lg"
                  variant="secondary"
                  className="min-h-[60px] px-6"
                >
                  Reset
                </Button>
                <Button
                  onClick={handleZoomIn}
                  size="lg"
                  variant="secondary"
                  className="min-w-[60px] min-h-[60px]"
                  disabled={scale >= 3}
                >
                  <ZoomIn className="h-6 w-6" />
                </Button>
              </div>
              <p className="text-center text-white/70 text-sm mt-2">
                Double tap to zoom • Pinch to zoom • Drag to pan
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}