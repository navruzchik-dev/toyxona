import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { setArtist } from '../redux/slices/artistSlice.js' // путь поправь под себя

const Artist = () => {
  const { id } = useParams()
  const dispatch = useDispatch()
  const artist = useSelector((state) => state.artist.data)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Если данные уже есть в Redux и id совпадает — не фетчим 
    if (artist && artist.id === id) return

    const fetchArtist = async () => {
      setLoading(true)
      try {
        const res = await fetch(`http://localhost:5000/artists/${id}`)
        if (!res.ok) throw new Error('Не найдено')
        const data = await res.json()
        dispatch(setArtist(data))
      } catch (err) {
        setError('Не удалось загрузить профиль')
      } finally {
        setLoading(false)
      }
    }

    fetchArtist()
  }, [id])

  if (loading) return <p>Загрузка...</p>
  if (error) return <p>{error}</p>
  if (!artist) return <p>Профиль не найден</p>

  return (
    <div>
      <h1>artist profile</h1>
      <h1>{artist.name}</h1>
      <p>{artist.genre}</p>
      <p>{artist.admin_phone}</p>
    </div>
  )
}

export default Artist