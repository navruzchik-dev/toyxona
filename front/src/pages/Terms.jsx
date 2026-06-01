import React from 'react'

const Terms = () => {

    const hospitals = ['Shifo Nur', 'dialab medical', 'Imed clinic', 'level med', ' Horev medical center']
  return (
    <div className='text-white mt-28 flex flex-col gap-10 ml-32'>
      <h1>Я соглашаюсь с условиями того что продаю свою левую почку за 20 000 долларов</h1>

      <div className="flex flex-col gap-1">
              <label className="text-white text-xl font-medium">Выберите больницу для операции по продажи почки</label>
              <select
                name="больницы"
                className="border-b w-1/2 border-gray-300  outline-none py-2 text-sm text-white bg-transparent transition-colors duration-150"
              >
                <option value="" className='text-xl text-black'>больница</option>
                {hospitals.map(k => <option key={k} value={k} className='text-black'>{k}</option>)}
              </select>
            </div>
    </div>
  )
}

export default Terms
