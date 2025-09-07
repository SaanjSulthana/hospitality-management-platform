import { useState, useCallback } from 'react';

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

interface ValidationRules {
  [key: string]: ValidationRule;
}

interface ValidationErrors {
  [key: string]: string;
}

export function useFormValidation<T extends Record<string, any>>(
  initialData: T,
  validationRules: ValidationRules
) {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback((field: string, value: any): string | null => {
    const rule = validationRules[field];
    if (!rule) return null;

    // Required validation
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
    }

    // Skip other validations if value is empty and not required
    if (!value && !rule.required) return null;

    // Min length validation
    if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
      return `${field.charAt(0).toUpperCase() + field.slice(1)} must be at least ${rule.minLength} characters`;
    }

    // Max length validation
    if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      return `${field.charAt(0).toUpperCase() + field.slice(1)} must be no more than ${rule.maxLength} characters`;
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return `${field.charAt(0).toUpperCase() + field.slice(1)} format is invalid`;
    }

    // Custom validation
    if (rule.custom) {
      return rule.custom(value);
    }

    return null;
  }, [validationRules]);

  const validateForm = useCallback((data: T): ValidationErrors => {
    const newErrors: ValidationErrors = {};
    
    Object.keys(validationRules).forEach(field => {
      const error = validateField(field, data[field]);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    return newErrors;
  }, [validationRules, validateField]);

  const setFieldError = useCallback((field: string, error: string | null) => {
    setErrors(prev => {
      if (error === null) {
        const { [field]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [field]: error };
    });
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldError(field, null);
  }, [setFieldError]);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const markFieldAsTouched = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const markAllFieldsAsTouched = useCallback(() => {
    const allTouched: Record<string, boolean> = {};
    Object.keys(validationRules).forEach(field => {
      allTouched[field] = true;
    });
    setTouched(allTouched);
  }, [validationRules]);

  const isFieldValid = useCallback((field: string) => {
    return !errors[field];
  }, [errors]);

  const isFormValid = useCallback(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  const getFieldError = useCallback((field: string) => {
    return touched[field] ? errors[field] : null;
  }, [errors, touched]);

  return {
    errors,
    touched,
    validateField,
    validateForm,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    markFieldAsTouched,
    markAllFieldsAsTouched,
    isFieldValid,
    isFormValid,
    getFieldError,
  };
}

// Common validation rules
export const commonValidationRules = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    required: true,
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    custom: (value: string) => {
      if (!/(?=.*[a-z])/.test(value)) return 'Password must contain at least one lowercase letter';
      if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain at least one uppercase letter';
      if (!/(?=.*\d)/.test(value)) return 'Password must contain at least one number';
      return null;
    },
  },
  required: {
    required: true,
  },
  subdomain: {
    required: true,
    pattern: /^[a-z0-9-]+$/,
    minLength: 3,
    maxLength: 63,
  },
  phone: {
    pattern: /^[\+]?[1-9][\d]{0,15}$/,
  },
  url: {
    pattern: /^https?:\/\/.+/,
  },
};
