import { useEffect, useState } from 'react'

const MODEL_PREF_KEY = 'otobun:last-model'

interface IModelPreference {
  selectedModelId: string
  customModelPath: string
}

const defaultModelPreference = (): IModelPreference => ({ selectedModelId: 'custom', customModelPath: '' })

const readModelPreference = (): IModelPreference => {
  if (typeof window === 'undefined') return defaultModelPreference()

  try {
    const rawValue = window.localStorage.getItem(MODEL_PREF_KEY)
    if (!rawValue) return defaultModelPreference()
    const parsedValue = JSON.parse(rawValue) as Partial<IModelPreference>
    return {
      selectedModelId: typeof parsedValue.selectedModelId === 'string' ? parsedValue.selectedModelId : 'custom',
      customModelPath: typeof parsedValue.customModelPath === 'string' ? parsedValue.customModelPath : '',
    }
  } catch {
    return defaultModelPreference()
  }
}

const writeModelPreference = (preference: IModelPreference) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MODEL_PREF_KEY, JSON.stringify(preference))
}

const useModelPreference = () => {
  const [model, setModel] = useState(() => readModelPreference().customModelPath)
  const [selectedModelId, setSelectedModelId] = useState<string>(() => readModelPreference().selectedModelId)

  useEffect(() => {
    writeModelPreference({ selectedModelId, customModelPath: model })
  }, [model, selectedModelId])

  return { model, selectedModelId, setModel, setSelectedModelId, writeModelPreference }
}

export type { IModelPreference }
export { useModelPreference, writeModelPreference }
