import React, { useState } from "react";

// Принимаем props прямо в аргументах функции (можно сразу сделать деструктуризацию: { onLogin })
export default function LoginModal({ onLogin }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        // Передаем введенные данные наверх родителю через функцию из props
        onLogin(username, password);
    };

    return (
        <div id="LoginModal" className="modal-overlay active">
            <div className="modal-content">
                <form id="LoginForm" onSubmit={handleSubmit}>
                    <h3>Вход в аккаунт или регистрация</h3>
                    <label>
                        Пользователь:
                        <input onChange={(e) => setUsername(e.target.value)} />
                    </label>
                    <label>
                        Пароль:
                        <input type="password" onChange={(e) => setPassword(e.target.value)} />
                    </label>
                    <button type="submit">Войти</button>
                </form>
            </div>
        </div>
    );
}