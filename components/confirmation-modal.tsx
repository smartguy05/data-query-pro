"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    variant?: "default" | "destructive"
}

export function ConfirmationModal({
                                      open,
                                      onOpenChange,
                                      title,
                                      description,
                                      confirmText = "Confirm",
                                      cancelText = "Cancel",
                                      onConfirm,
                                      variant = "default"
                                  }: ConfirmationModalProps) {
    const handleConfirm = () => {
        onConfirm()
        onOpenChange(false)
    }

    const handleCancel = () => {
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        {cancelText}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        variant={variant === "destructive" ? "destructive" : "default"}
                    >
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}