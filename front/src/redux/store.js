import { configureStore } from '@reduxjs/toolkit'
import artistReducer from './slices/artistSlice.js'
import hallReducer from './slices/hallSlice.js'

const store = configureStore({
  reducer: {
    artist: artistReducer,
    hall: hallReducer,
  }
})

export default store