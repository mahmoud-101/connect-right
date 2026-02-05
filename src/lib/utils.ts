import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Helper لتبديل القيم بناءً على اتجاه اللغة
 */
export function rtlValue<T>(isRtl: boolean, rtl: T, ltr: T): T {
  return isRtl ? rtl : ltr
}
