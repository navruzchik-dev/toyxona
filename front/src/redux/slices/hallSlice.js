import { createSlice } from '@reduxjs/toolkit'

const hallSlice = createSlice({
  name: 'hall',
  initialState: {
    data: null,
  },
  reducers: {
    setHall: (state, action) => {
      state.data = action.payload
    },
    clearHall: (state) => {
      state.data = null
    }
  }
})

export const { setHall, clearHall } = hallSlice.actions
export default hallSlice.reducer