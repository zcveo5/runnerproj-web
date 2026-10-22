import React, { useState } from "react";
import formatRelativeTime from '../utils/dates.js'

export default function WorkoutsView({ workouts, select_cb }) {
    if (!workouts) {
        return (<div>Invalid WO {typeof workouts}</div>)
    }

    return (
        <div id="Workouts">
            {workouts.map((value, idx) => {
                let cardClassName = 'wo-card'

                const date = new Date(value.date)
                const now = new Date()

                now.setHours(23, 59, 59)

                if (date < now) {
                    cardClassName = cardClassName + ' wo-card-was'
                    if (value.result ?? 0 === 0) {
                        cardClassName += ' wo-card-skipped'
                    }
                }

                if (value.result ?? 0 > 0) {
                    cardClassName += ' wo-card-completed'
                }

                return (
                   <div className={cardClassName} key={idx} onClick={() => {select_cb(value)}}>
                       <div className="wo-header">
                           <span className="wo-date">{value.date}</span>
                           <span className="wo-relative">{formatRelativeTime(value.date)}</span>
                       </div>
                       <div className="wo-target">Цель: <strong>{value.target}</strong> Km,
                           получилось <strong>{value.result ?? 0}</strong> Km</div>
                   </div>
            )
            })}
        </div>
    );
}