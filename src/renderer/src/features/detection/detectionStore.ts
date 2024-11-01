import { configureStore } from '@reduxjs/toolkit'
import detectionReducer from './detectionSlice'

export const detectionstore = configureStore({
  reducer: {
    detection: detectionReducer
  }
})

export type RootState = ReturnType<typeof detectionstore.getState>
export type AppDispatch = typeof detectionstore.dispatch
