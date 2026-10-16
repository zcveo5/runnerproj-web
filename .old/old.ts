import {WsClient} from "../static/ws"; // Не забываем .js для Firefox модулей

import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm';

Chart.register(...registerables);

let client = new WsClient('/ws');

// Приводим к правильным типам для TypeScript
const login_modal = document.getElementById("LoginModal") as HTMLDivElement | null;
const login_form = document.getElementById("LoginForm") as HTMLFormElement | null; // Добавили ID для формы
const login_username = document.getElementById("LoginUsernameInput") as HTMLInputElement | null;
const login_password = document.getElementById("LoginPasswordInput") as HTMLInputElement | null;

const sh_modal = document.getElementById("ScheduleCreateModal") as HTMLDivElement;
const sh_form = document.getElementById("ScheduleCreateForm") as HTMLFormElement; // Добавили ID для формы
const sh_current = document.getElementById("ScheduleCreateCurrent") as HTMLInputElement;
const sh_target = document.getElementById("ScheduleCreateTarget") as HTMLInputElement;
const notes = document.getElementById("Notes") as HTMLDivElement;
const workouts = document.getElementById("Workouts") as HTMLDivElement

const settings_modal = document.getElementById("SettingsModal") as HTMLDivElement
const settings_btn = document.getElementById("SettingsButton") as HTMLButtonElement
const settings_close_btn = document.getElementById("SettingsExit") as HTMLButtonElement
const settings_reset_s = document.getElementById("SettingsResetSchedule") as HTMLButtonElement
const settings_exit_acc = document.getElementById("SettingsExitAccount") as HTMLButtonElement
const loading_modal = document.getElementById("LoadingModal") as HTMLDivElement
const wo_view_modal = document.getElementById("WorkoutViewModal") as HTMLDivElement
const wo_view_close = document.getElementById("WOViewClose") as HTMLButtonElement
const wo_view_cancel = document.getElementById("WOViewCancel") as HTMLButtonElement
const wo_view_date = document.getElementById("WOViewDate") as HTMLInputElement
const wo_view_target = document.getElementById("WOViewTarget") as HTMLInputElement
const wo_view_date_fr = document.getElementById("WOViewDateWD") as HTMLInputElement
const wo_view_target_fr = document.getElementById("WOViewTargetWD") as HTMLInputElement
const wo_view_completed_fr = document.getElementById("WOViewCompletedWithDecs") as HTMLInputElement
const wo_view_completed = document.getElementById("WOViewCompleted") as HTMLInputElement

const login_btn = document.getElementById("LoginSubmit") as HTMLButtonElement
const DebugResetSchedule = document.getElementById("DebugResetSchedule") as HTMLButtonElement
const DebugScheduleStartDate = document.getElementById("DebugScheduleStartDate") as HTMLInputElement
const DebugScheduleCurrent = document.getElementById("DebugScheduleCurrent") as HTMLInputElement
const DebugScheduleTarget = document.getElementById("DebugScheduleTarget") as HTMLInputElement
const DebugModal = document.getElementById("DebugModal") as HTMLDivElement
const DebugExit = document.getElementById("DebugExit") as HTMLButtonElement

const test = document.getElementById('TestB') as HTMLButtonElement
test.onclick = () => {notify('Test')}
test.remove()

wo_view_close.onclick = () => {closeModal(wo_view_modal)}

function openModal(modal: HTMLElement | null) {
    modal?.classList.add('active');
}

function closeModal(modal: HTMLElement | null) {
    modal?.classList.remove('active');
}

settings_exit_acc.onclick = async () => {
    await client?.ask('un_auth');

    // 2. Чистим куки и состояние на фронте
    deleteCookie('username');
    deleteCookie('session_token');
    schedule = null;

    // 3. Сбрасываем интерфейс
    closeModal(settings_modal);
    settings_btn.classList.add('hidden');
    reset_status();
    workouts.querySelectorAll('.wo-card').forEach((c) => c.remove());

    if (login_username) login_username.value = '';
    if (login_password) login_password.value = '';

    // 4. Показываем окно входа без переподключения WS
    await init()
}

let is_shift = false;

document.onkeydown = (ev) => {
    if (ev.key === 'Shift') {
        is_shift = true
    }
}

document.onkeyup = (ev) => {
    if (ev.key === 'Shift') {
        is_shift = false
    }
}


settings_btn.onclick = () => {
    if (is_shift)
        openModal(DebugModal)
    else
        openModal(settings_modal)
}

settings_close_btn.onclick = () => {
    closeModal(settings_modal)
}

DebugExit.onclick = () => {closeModal(DebugModal)}

async function reset_schedule() {
    closeModal(settings_modal)
    await client?.ask('delete_schedule')
    await start_app()
}

DebugResetSchedule.onclick = async () => {
    const start_date = DebugScheduleStartDate.valueAsDate
    const now = parseFloat(DebugScheduleCurrent.value)
    const target = parseFloat(DebugScheduleTarget.value)

    if (!start_date || !now || !target) {
        notify(`Invalid data ${start_date} ${now} ${target}`)
        return
    }

    console.log(start_date, 'NOW', now, "TARG", target)

    openModal(loading_modal)

    const timestampSec = Math.floor(start_date.getTime()     / 1000);

    await client.ask('new_schedule', {now: now, final: target, interval: 1.2, start_date: timestampSec})

    await reloadSchedule()

    closeModal(loading_modal)
    closeModal(DebugModal)
}

settings_reset_s.onclick = async () => { await reset_schedule()}

function rm_notification(elem: HTMLLabelElement) {
    // Находим невидимую сетку-обертку, в которой лежит наш лейбл
    const wrapper = elem.parentElement as HTMLDivElement;
    if (!wrapper) return;

    // Запускаем скрытие сетки и карточки
    wrapper.classList.add('exit-hidden');

    // Полностью удаляем всю конструкцию из DOM через 300ms
    setTimeout(() => {
        wrapper.remove();
    }, 300);
}

function notify(text: string) {
    // 1. Создаем невидимую обертку-сетку
    const wrapper = document.createElement('div');
    wrapper.className = 'notification-wrapper enter-hidden';

    // 2. Создаем твою карточку-label
    const elem = document.createElement('label');
    elem.className = 'notification';
    elem.textContent = text;

    // Собираем их вместе
    wrapper.appendChild(elem);
    notes.appendChild(wrapper);

    // Включаем появление анимации
    requestAnimationFrame(() => {
        wrapper.classList.remove('enter-hidden');
    });

    // Твоя логика проверки ховера перед удалением (работает идеально)
    setTimeout(() => {
        if (elem.matches(':hover')) {
            elem.addEventListener('mouseleave', () => {
                setTimeout(() => { rm_notification(elem); }, 300);
            });
        } else {
            rm_notification(elem);
        }
    }, 3000);
}

let schedule = null as Array | null;

function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

function deleteCookie(name: string): void {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

function formatRelativeTime(dateStr: string): string {
    const targetDate = new Date(dateStr);
    const now = new Date();

    // Сбрасываем время до начала дня, чтобы считать именно чистые дни
    targetDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffInMs = targetDate.getTime() - now.getTime();
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Сегодня';
    if (diffInDays === 1) return 'Завтра';
    if (diffInDays === -1) return 'Вчера';

    // Для остальных случаев задействуем нативный RelativeTimeFormat
    const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });

    if (Math.abs(diffInDays) >= 7 && Math.abs(diffInDays) % 7 === 0) {
        return rtf.format(diffInDays / 7, 'week'); // "через 1 неделю", "через 2 недели"
    }

    return rtf.format(diffInDays, 'day'); // "через 2 дня", "через 5 дней"
}

async function commit_date() {
    // Берём дату из инпута
    const dateObj = wo_view_date.valueAsDate;
    if (!dateObj) {
        return;
    }

    // Переводим миллисекунды в секунды (Math.floor от .getTime() / 1000)
    // 10-значное число (например: 1757030400), которое Python проглотит идеально
    const timestampSec = Math.floor(dateObj.getTime() / 1000);

    console.log(`Send new ts: ${timestampSec} (from ${dateObj}) ${parseFloat(wo_view_target.value)}`);

    const resp = await client?.ask('update_schedule', {
        idx: selected_wo,
        new_date_str: timestampSec,
        new_target: parseFloat(wo_view_target.value)
    });

    if (resp && resp.status !== 'ok') {
        notify(`update_schedule failed ${resp.payload.desc}`);
        return true;
    }

    await reloadSchedule();
    return false;
}

let selected_wo = NaN
let selected_wo_elem: HTMLElement | null = null

function edit_wo() {
    wo_view_cancel.classList.remove('hidden')
    wo_view_close.textContent = 'Изменить расписание'
    wo_view_close.onclick = async () => {
        closeModal(wo_view_modal)
        const reask = await commit_date()
        if (reask) {
            openModal(wo_view_modal)
            return
        }
    }
}

function complete_wo() {
    wo_view_cancel.classList.remove('hidden')
    wo_view_close.textContent = 'Подтвердить'
    wo_view_close.onclick = async () => {
        closeModal(wo_view_modal)
        await client.ask('complete_workout', {idx: selected_wo, result: parseFloat(wo_view_completed.value)})
        await reloadSchedule()
    }
}

wo_view_date.addEventListener('input', edit_wo)
wo_view_target.addEventListener('input', edit_wo)
wo_view_completed_fr.addEventListener('input', complete_wo)

wo_view_cancel.onclick = () => {closeModal(wo_view_modal)}


function parseScheduleDate(date: string) {
    const isoFormatted: string = date.replace(/\./g, "-");
    return new Date(isoFormatted);
}

const WOViewTitle = document.getElementById("WOViewTitle") as HTMLLabelElement
const WOViewCompletedInfo = document.getElementById("WOViewCompletedInfo") as HTMLLabelElement

function createWOViewCallback(idx: number, plan: any, elem: HTMLDivElement){
    const isoFormatted: string = plan.date.replace(/\./g, "-");
    const parsedDate: Date = new Date(isoFormatted);
    const tm = parsedDate.getTime()
    const now = new Date()
    now.setHours(23, 59, 59, 0)

    return () => {
        WOViewTitle.textContent = 'Просмотр тренировки'
        WOViewCompletedInfo.classList.add('hidden')
        wo_view_close.textContent = 'Закрыть'
        wo_view_close.onclick = () => {closeModal(wo_view_modal)}
        wo_view_cancel.classList.add('hidden')
        wo_view_completed.value = ''

        if (is_shift && plan.status === 'completed') {
            selected_wo = idx
            wo_view_completed_fr.classList.remove('hidden')
            wo_view_target_fr.classList.add('hidden')
            wo_view_date_fr.classList.add('hidden')
            openModal(wo_view_modal)
            return
        }

        if (plan.status === 'completed') {
            selected_wo = idx
            WOViewCompletedInfo.textContent = `Результат ${plan.result} Km`
            WOViewCompletedInfo.classList.remove('hidden')
            wo_view_completed_fr.classList.add('hidden')
            wo_view_target_fr.classList.add('hidden')
            wo_view_date_fr.classList.add('hidden')
            openModal(wo_view_modal)
            return
        }

        selected_wo_elem = elem
        selected_wo = idx

        if (!is_shift) {
            if (tm > now.getTime()) {
                wo_view_completed_fr.classList.add('hidden')
                wo_view_target_fr.classList.remove('hidden')
                wo_view_date_fr.classList.remove('hidden')
            } else {
                wo_view_completed_fr.classList.remove('hidden')
                wo_view_target_fr.classList.add('hidden')
                wo_view_date_fr.classList.add('hidden')
            }
        } else {
            WOViewTitle.textContent = 'Отладка тренировки'
            wo_view_completed_fr.classList.remove('hidden')
            wo_view_target_fr.classList.remove('hidden')
            wo_view_date_fr.classList.remove('hidden')
        }

        openModal(wo_view_modal)
        wo_view_date.valueAsDate = parsedDate
        wo_view_target.value = plan.target.toString() //+ ` | Debug ${idx} Date ${date_str} (${tm}) Targ ${target}`
    }
}

function createWOLabel(idx: number, plan: any) {
    const date_str = plan.date
    const target = plan.target
    const state = plan.status

    let elem = document.createElement('div');
    const targetDate = new Date(date_str);
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    targetDate.setHours(0, 0, 0, 0);
    elem.className = 'wo-card';

    const relativeTime = formatRelativeTime(date_str);

    if (targetDate.getTime() < now.getTime()) {
        elem.classList.add('wo-card-was')
        if (state === 'pending') {
            elem.classList.add('wo-card-skipped')
        }
    }

    if (state == 'completed') {
        elem.classList.add('wo-card-completed')
    }

    elem.innerHTML = `
        <div class="wo-header">
            <span class="wo-date">${date_str}</span>
            <span class="wo-relative">${relativeTime}</span>
        </div>
        <div class="wo-target">Цель: <strong>${target}</strong> Km, получилось <strong>${plan.result ?? 0}</strong> Km</div>
    `;

    elem.onclick = createWOViewCallback(idx, plan, elem)

    workouts.appendChild(elem);
}

function updateChart(newDates: string[], newKm: number[], newKm2: number[]) {
    progressChart.data.labels = newDates
    progressChart.data.datasets[0].data = newKm   // красная
    progressChart.data.datasets[1].data = newKm2  // синяя
    progressChart.update()
}

async function reloadSchedule(plan_or: any = null) {
    workouts.querySelectorAll('.wo-card').forEach((c) => {c.remove()})

    let old_txt = workouts.innerHTML

    let plan = plan_or;

    if (plan === null) {
        workouts.innerHTML = 'Загрузка'
        plan = await client?.ask('get_schedule');
    }

    if (plan) {
        schedule = plan.payload
    }

    workouts.innerHTML = old_txt

    if (schedule && schedule.length > 0) {
        for (const planKey in schedule) {
            let plan_el = schedule[planKey]
            createWOLabel(parseInt(planKey), plan_el)
        }
    } else {
        let elem = document.createElement('div')
        elem.className = 'wo-card';

        elem.innerHTML = `
        <div class="wo-target">Тренировок нет, пересоздайте расписание!</div>`;

        elem.onclick = reset_schedule
        workouts.appendChild(elem)
    }

    const dates = []
    const km1s = []
    const km2s = []

    schedule?.forEach((value: any) => {
        dates.push(value.date)
        km1s.push(value.target)
        km2s.push(value.result ?? 0)
    })

    updateChart(dates, km2s, km1s)
}

const statusLbl = document.getElementById('StatusLbl') as HTMLLabelElement
const statusCnt = document.getElementById('Status') as HTMLDivElement

function set_status(text: string) {
    statusCnt.classList.remove('hidden')
    statusLbl.textContent = text
}
function reset_status() {
    statusCnt.classList.add('hidden')
    statusLbl.textContent = ''
}

async function start_app() {
    set_status('Загрузка расписания')
    let plan: any
    try {
        plan = await client?.ask('get_schedule');
    } catch (err) {
        plan = null
    }

    if (!plan || plan.status !== 'ok') {
        // Ждем, пока юзер заполнит sh_form и получаем resp
        let resp = null;
        while (true) {
            resp = await askSchedule()
            console.log(resp)
            if (resp.status === 'ok') {
                schedule = resp.payload;
                break
            } else {
                notify(`Server returns: ${resp.payload.desc}`)
            }
        }
    } else {
        schedule = plan.payload;
    }

    settings_btn.classList.remove('hidden')

    await reloadSchedule(plan)
    reset_status()
}

const slider = document.getElementById('DebugScheduleDateMove') as HTMLInputElement;
const sliderValue = document.getElementById('DebugMoveValue') as HTMLLabelElement;
const DebugScheduleDateMoveCommit = document.getElementById("DebugScheduleDateMoveCommit") as HTMLButtonElement;


function stringifyDate(date: Date): string {
    const year = date.getFullYear();

    // Прибавляем 1 к месяцу и дополняем нулем слева, если число однозначное
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Берем день месяца вместо дня недели
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}.${month}.${day}`;
}


// Функция для красивого склонения слова "день" (опционально, но круто)
function getDaysWord(days) {
    if (days === 1) return '1 день';
    if (days >= 2 && days <= 4) return `${days} дня`;
    return `${days} дней`;
}

// Слушаем событие изменения слайдера
slider.addEventListener('input', (e) => {
    const value = parseInt(e.target?.value);
    sliderValue.textContent = getDaysWord(value);
});

DebugScheduleDateMoveCommit.onclick = async () => {
    schedule?.forEach((value: any, index: number, array: any) => {
        //schedule[index].date =
        let date = parseScheduleDate(value.date)
        date.setDate(date.getDate() + parseInt(slider.value))
        schedule[index].date = stringifyDate(date)
    })
    await client.ask('upload_schedule', {plan: schedule})
    await reloadSchedule()
}

// Главная функция инициализации
async function init() {
    set_status(`Подключение и получение кук`)

    const sess_token = getCookie('session_token')
    let sessionToken = null
    if (sess_token && sess_token !== 'undefined') {
        sessionToken = await client.ask('decrypt', {string: sess_token})
    }
    const user_cook = getCookie('username')
    let usernameCookie = null
    if (user_cook && user_cook !== 'undefined') {
        usernameCookie = await client.ask('decrypt', {string: user_cook})
    }

    set_status(`Вход в "${usernameCookie?.payload.string}" `)

    if (sessionToken && usernameCookie) {
        const isOk = await client.login({ username: usernameCookie.payload.string, token: sessionToken.payload.string});
        if (isOk !== null && isOk.status === 'ok') {
            await start_app();
            return;
        }
        deleteCookie('session_token');
        deleteCookie('username');
    }

    if (login_modal) {
        openModal(login_modal)
    }
}

function askSchedule(): Promise<any> {
    return new Promise((resolve) => {
        if (sh_modal) {
            openModal(sh_modal)
        }

        const handleSubmit = async (event: SubmitEvent) => {
            event.preventDefault();

            const now = parseFloat(sh_current.value)
            const final = parseFloat(sh_target.value)

            if (!now || !final) {
                notify('Невалидные данные')
                return
            }

            const resp = await client?.ask('new_schedule', {
                now: now,
                final: final,
                interval: 2
            });

            // Закрываем модалку и снимаем слушатель
            closeModal(sh_modal)
            sh_form?.removeEventListener('submit', handleSubmit);

            resolve(resp);
        };

        sh_form?.addEventListener('submit', handleSubmit);
    });
}


const Graph = document.getElementById("Graph") as HTMLDivElement
const PagerWorkouts = document.getElementById("PagerWorkouts") as HTMLButtonElement;
const PagerGraph = document.getElementById("PagerGraph") as HTMLButtonElement;
const sliderTrack = document.getElementById("SliderTrack") as HTMLDivElement;

// Клик на «Тренировки» — сдвигаем ленту в самое начало (0%)
PagerWorkouts.onclick = () => {
    sliderTrack.style.transform = "translateX(0%)";
};

// Клик на «График» — сдвигаем ленту влево на 50% (показываем вторую страницу)
PagerGraph.onclick = () => {
    sliderTrack.style.transform = "translateX(-50%)";
};
// Слушаем событие submit у ФОРМЫ (срабатывает и от кнопки, и от Enter)
if (login_form) {
    login_form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Останавливаем перезагрузку страницы браузером

        if (!client || !login_username || !login_password) return;

        login_btn.innerHTML = '<div class="spinner"></div><label>Вход...</label>'

        const res = await client.login({ username: login_username.value, password: login_password.value });

        if (res && res.payload.token) {
            const sessionToken = await client.ask('encrypt', {string: res.payload.token})
            const usernameCookie = await client.ask('encrypt', {string: res.payload.username})
            if (sessionToken.status !== 'ok' && usernameCookie.status !== 'ok') {
                console.warn(sessionToken, usernameCookie)
                notify('Failed to encrypt cookies')
            }
            document.cookie = `session_token=${sessionToken.payload.string}; path=/; max-age=86400`;
            document.cookie = `username=${usernameCookie.payload.string}; path=/; max-age=86400`;
            closeModal(login_modal)
            await start_app();
        } else {
            console.log('Auth failed', res)
            notify(`Login error: ${res?.payload.desc}`)
        }

        login_btn.innerHTML = 'Войти'
    });
}

// Находим все заголовки секций и вешаем на них клик
document.querySelectorAll('.section-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
        // Находим родительскую секцию именно для этого заголовка
        const section = toggle.closest('.debug-section');

        // Переключаем класс сворачивания
        section?.classList.toggle('is-collapsed');
    });
});


const canvas = document.getElementById('GraphCanvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')

const dates: string[] = []
const kilometers: number[] = []
const kilometers2: number[] = []

// 3. Создаем график
const progressChart = new Chart(ctx, {
    type: 'line', // Тип графика: линейный
    data: {
        labels: dates,
        datasets: [
            {
                label: 'Пробег (км)',
                data: kilometers,
                borderColor: '#ff0000',
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#ff0000'
            },
            {
                label: 'План (км)', // назовите как нужно
                data: kilometers2,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#007bff'
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true, // Начинать ось Y всегда с нуля
                grid: { color: 'rgba(255, 255, 255, 0.1)' }, // Цвет сеточки
                ticks: { color: '#ccc' } // Цвет текста цифр
            },
            x: {
                grid: { display: false }, // Скрываем вертикальные линии сетки
                ticks: { color: '#ccc' }
            }
        },
        plugins: {
            legend: {
                labels: { color: '#fff' } // Цвет текста легенды
            }
        }
    }
});


// Запуск
init();
