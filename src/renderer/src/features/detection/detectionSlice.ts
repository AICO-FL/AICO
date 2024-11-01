import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface DetectionState {
  isHeadDetected: boolean
}

const initialState: DetectionState = {
  isHeadDetected: false
}

const detectionSlice = createSlice({
  name: 'detection',
  initialState,
  reducers: {
    setHeadDetected: (state, action: PayloadAction<boolean>) => {
      state.isHeadDetected = action.payload
    }
  }
})

export const { setHeadDetected } = detectionSlice.actions
export default detectionSlice.reducer
