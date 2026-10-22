import React, {use, useState} from "react";
import stringifyDate from '../utils/dates.js'

export default function WorkoutScreen({ wo, cb }) {
    const [isEdited, setIsEdited] = useState(false)

    if (!wo) return;

    const procEdit = (e) => {
        e.preventDefault()
        setIsEdited(false)
        cb(null)
    }

    return (
        <div className="modal-overlay active">
            <div className="modal-content">
                <h3>Редактирование тренировки</h3>

                <form onSubmit={procEdit}>
                    <div style={{marginTop: 5, display: 'flex', flexDirection: 'row'}}>
                        <label>Дата <input type={'date'} onChange={(e) => {wo.date = stringifyDate(e.target.valueAsDate)}}/></label>

                        {isEdited ? (
                        <button type='submit'>Подтвердить</button>
                            ) : (<></>)}
                        <button onClick={() => {cb(null)}}>Отменить</button>
                    </div>
                </form>
            </div>
        </div>
    );
}