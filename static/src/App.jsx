import React, {useEffect, useState} from "react";
import {WsClient} from "./ws.js";
import LoginModal from "./components/LoginScreen.jsx";
import Notifications from "./components/Notifications.jsx";
import {deleteCookie, getCookie, setCookie} from './utils/cookies.js'
import WorkoutsView from "./components/WorkoutsView.jsx";

const client = new WsClient('/ws')

// Returns status, username (or error, on failure), token (or null, on failure)
async function login(username, password=null, token=null) {
    let res
    try {
        res = await client.login(username, password, token);
    } catch (e) {
        return {status: false, error: `${e} (catch)`}
    }
    if (res && res.status === 'ok') {
        return {status: true, username: res.payload.username, token: res.payload.token}
    } else {
        return {status: false, error: res.payload.desc}
    }
}

async function un_login() {
    await client.ask('un_auth')
    deleteLoginCookies()
}

function deleteLoginCookies() {
    deleteCookie('username')
    deleteCookie('token')
}

function setLoginCookies(username, token) {
    setCookie('username', username, {'max-age': 604800})
    setCookie('token', token, {'max-age': 604800})
}

function getLoginCookies() {
    return {username: getCookie('username'), token: getCookie('token')}
}

let cookieLoginCompleted = false
let schedule = null

export default function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [notes, setNotes] = useState([]);
    const [workouts, setWorkouts] = useState([])

    const notify = (text) => {
        setNotes((prev) => [...prev, text]);
        setTimeout(() => {
            setNotes((prev) => prev.slice(1));
        }, 3000);
    };

    const handleUserLogin = async (username, password) => {
        const loginRes = await login(username, password)

        if (loginRes.status) {
            setIsLoggedIn(true);
            console.log('Successfully userLogin', loginRes)
            setLoginCookies(loginRes.username, loginRes.token)
        } else {
            console.warn(`Login error (resp): `, loginRes)
            notify(`Error: ${loginRes.error}`)
        }
    };

    // AUTOLOGIN
    useEffect(() => {
        const _ = async () => {
            if (cookieLoginCompleted) return
            cookieLoginCompleted = true

            const loginCookies = getLoginCookies()
            if (loginCookies.username && loginCookies.token) {

                const loginRes = await login(loginCookies.username, null, loginCookies.token)

                if (loginRes.status) {
                    setIsLoggedIn(true);
                    setLoginCookies(loginRes.username, loginRes.token)
                } else {
                    deleteLoginCookies()
                    console.warn(`autologin error (resp): `, loginRes, 'login with', loginCookies)
                    notify(`Autologin Error: ${loginRes.error}`)
                }
            }

            setIsLoading(false)
        }
        _()
    }, [])

    useEffect(() => {
        const _ = async () => {
            console.log('first schedule load')
            schedule = (await client.ask('get_schedule')).payload
            setWorkouts(schedule)
        }
        _()
    }, [])

    if (isLoading) {
        return <div>Загрузка приложения...</div>;
    }

    return (
        <div>
            <Notifications notes={notes}/>

            {!isLoggedIn ? (
                <LoginModal onLogin={handleUserLogin} />
            ) : (
                <div>
                    <button onClick={async () => {
                        await un_login()
                        setIsLoggedIn(false)
                    }}>Выйти</button>
                    <WorkoutsView workouts={workouts}/>
                </div>
            )}
        </div>
    );
}