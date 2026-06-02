"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function ToastProvider({
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />
}

function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed right-4 bottom-4 z-100 flex max-h-screen w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none sm:right-6 sm:bottom-6",
        className
      )}
      {...props}
    />
  )
}

function Toast({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root>) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "group pointer-events-auto relative grid gap-1 overflow-hidden rounded-md border bg-popover px-4 py-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 transition-all data-closed:animate-out data-closed:fade-out-80 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-2 data-swipe=end:translate-x-[var(--radix-toast-swipe-end-x)] data-swipe=move:translate-x-[var(--radix-toast-swipe-move-x)] data-swipe=cancel:translate-x-0 data-swipe=cancel:transition-transform",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-semibold", className)}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
}
