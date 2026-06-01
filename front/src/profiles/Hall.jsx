import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'

const Hall = () => {
  const { id } = useParams()
  const restaurant = useSelector((state) => state.hall.data)

  if (!restaurant) return <p>Загрузка...</p>

  return (
    <div>
        <h1>restaurant profile</h1>
      <h1>{restaurant.name}</h1>
      <p>{restaurant.district}</p>
      <p>{restaurant.address}</p>
    </div>
  )
}

export default Hall