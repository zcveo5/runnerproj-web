export function getCookie(name) {
    // Ищем куку по имени с учетом экранирования
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + "=([^;]*)"
    ));

    // Если нашли — декодируем значение, иначе возвращаем undefined
    return matches ? decodeURIComponent(matches[1]) : null;
}

export function setCookie(name, value, options = {}) {
    // Задаем дефолтные параметры (например, срок жизни)
    options = {
        path: '/', // Доступно для всего сайта
        // expires: 7, // Можно указать дни
        ...options
    };

    if (options.expires instanceof Date) {
        options.expires = options.expires.toUTCString();
    }

    // 1. Обязательно экранируем и имя, и значение
    let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);

    // 2. Добавляем остальные параметры (expires, path, domain, secure)
    for (let optionKey in options) {
        updatedCookie += "; " + optionKey;
        let optionValue = options[optionKey];
        if (optionValue !== true) {
            updatedCookie += "=" + optionValue;
        }
    }

    document.cookie = updatedCookie;
}

export function deleteCookie(name) {
    setCookie(name, null, {'max-age': -1})
}