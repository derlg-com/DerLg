'use client'

import { useCallback, useState } from 'react'
import type { ZodType } from 'zod'

export interface ZodFormApi<T> {
  values: T
  errors: Partial<Record<keyof T, string>>
  setValue: <K extends keyof T>(key: K, value: T[K]) => void
  setError: (key: keyof T, message: string) => void
  clearErrors: () => void
  /** Validate current values; returns parsed data or null and populates field errors. */
  validate: () => T | null
}

/**
 * Minimal controlled-form helper backed by a Zod schema. Maps the first issue
 * per field into `errors`. Keeps the lightweight stack (no React Hook Form).
 */
export function useZodForm<T extends Record<string, unknown>>(
  schema: ZodType<T>,
  initial: T,
): ZodFormApi<T> {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})

  const setValue = useCallback<ZodFormApi<T>['setValue']>((key, value) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }, [])

  const setError = useCallback((key: keyof T, message: string) => {
    setErrors((e) => ({ ...e, [key]: message }))
  }, [])

  const clearErrors = useCallback(() => setErrors({}), [])

  const validate = useCallback((): T | null => {
    const result = schema.safeParse(values)
    if (result.success) {
      setErrors({})
      return result.data
    }
    const fieldErrors: Partial<Record<keyof T, string>> = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof T | undefined
      if (key !== undefined && fieldErrors[key] === undefined) {
        fieldErrors[key] = issue.message
      }
    }
    setErrors(fieldErrors)
    return null
  }, [schema, values])

  return { values, errors, setValue, setError, clearErrors, validate }
}
