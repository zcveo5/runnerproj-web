import React, { useState } from "react";

export default function Settings({ settings, close_cb }) {
    return (
        <div className="modal-overlay active">
            <div className="modal-content">
                <h3>Настройки</h3>
                {
                    settings.map((value, idx) => {
                        if (value.command !== null && value.text !== null) {
                            return (<button key={idx} onClick={value.command}>{value.text}</button>)
                        }
                    })
                }
                <button style={{marginTop: 5}} onClick={close_cb}>Close</button>
            </div>
        </div>
    );
}