import React, { useState } from "react";

export default function Notifications({ notes }) {
    return (
        <div id="Notes">
            {notes.map((note, index) => (
                <div key={index} className="notification-wrapper">
                    <label className="notification">{note}</label>
                </div>
            ))}
        </div>
    );
}