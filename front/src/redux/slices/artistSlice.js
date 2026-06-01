import { createSlice } from '@reduxjs/toolkit'

const artistSlice = createSlice({
  name: 'artist',
  initialState: {
    data: null,
  },
  reducers: {
    setArtist: (state, action) => {
      state.data = action.payload
    },
    clearArtist: (state) => {
      state.data = null
    }
  }
})

export const { setArtist, clearArtist } = artistSlice.actions
export default artistSlice.reducer