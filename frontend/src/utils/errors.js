/**
 * Утилита для превращения ошибок API в человеческие сообщения.
 *
 * Обрабатывает:
 * - Строковые ошибки (FastAPI HTTPException)
 * - Pydantic 422 (массив ошибок валидации)
 * - Объекты с полем detail / message
 * - Сетевые ошибки (timeout, network)
 */

const FIELD_LABELS = {
  email: 'Email',
  username: 'Имя пользователя',
  password: 'Пароль',
  full_name: 'Полное имя',
  file: 'Файл',
  well_id: 'ID скважины',
  method: 'Метод',
  params: 'Параметры',
  curve_mapping: 'Маппинг кривых',
  computation_refs: 'Источники данных',
  output_mnemonic: 'Имя расчёта',
};

/**
 * Пытается превратить Pydantic-ошибку (msg) в человеческий текст.
 */
function rewritePydanticMsg(msg, type) {
  const lower = String(msg).toLowerCase();
  if (lower.includes('email') && (lower.includes('valid') || lower.includes('format'))) {
    return 'Некорректный формат email';
  }
  if (type === 'missing') {
    return 'Обязательное поле';
  }
  if (type === 'string_too_short' || lower.includes('at least')) {
    const m = msg.match(/(\d+)/);
    return m ? `Слишком короткое значение (минимум ${m[1]})` : 'Слишком короткое значение';
  }
  if (type === 'string_too_long') {
    return 'Слишком длинное значение';
  }
  if (type === 'value_error') {
    // Общие value_error — вернуть исходное (оно обычно информативное)
    return msg;
  }
  // Fallback — возвращаем как есть
  return msg;
}

/**
 * Извлекает осмысленное сообщение из объекта ошибки Axios.
 * @param {any} err — ошибка из catch
 * @param {string} fallback — сообщение по умолчанию
 * @returns {string}
 */
export function extractErrorMessage(err, fallback = 'Что-то пошло не так') {
  if (!err) return fallback;

  // Строковая ошибка (например, throw "text")
  if (typeof err === 'string') return err;

  // Сетевая ошибка (нет ответа от сервера)
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
    return 'Сервер недоступен. Проверьте подключение.';
  }

  const status = err.response?.status;
  const data = err.response?.data;

  // 5xx — сервер упал / прокси недоступен
  if (status === 502 || status === 503 || status === 504) {
    return 'Сервер не отвечает. Проверьте, запущен ли backend.';
  }
  if (status === 500) {
    return 'Внутренняя ошибка сервера. Попробуйте позже или перезапустите backend.';
  }
  if (status === 403) {
    return 'Недостаточно прав для этого действия.';
  }
  if (status === 404) {
    return 'Запрашиваемый ресурс не найден.';
  }

  if (!data) {
    return err.message || fallback;
  }

  const detail = data.detail;

  // Строка — вернуть как есть
  if (typeof detail === 'string') {
    return detail;
  }

  // Массив — Pydantic 422
  if (Array.isArray(detail)) {
    const lines = [];
    for (const item of detail) {
      if (typeof item === 'string') {
        lines.push(item);
        continue;
      }
      const loc = Array.isArray(item.loc) ? item.loc : [];
      // Берём последний «человеческий» сегмент loc (не 'body', не индексы)
      const field = [...loc].reverse().find((s) => typeof s === 'string' && s !== 'body');
      const fieldLabel = FIELD_LABELS[field] || field || '';
      const msg = rewritePydanticMsg(item.msg || '', item.type || '');
      lines.push(fieldLabel ? `${fieldLabel}: ${msg}` : msg);
    }
    return lines.length > 0 ? lines.join('; ') : fallback;
  }

  // Объект с message
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') return detail.message;
    if (typeof detail.msg === 'string') return detail.msg;
  }

  // Объект без detail — ищем message
  if (typeof data.message === 'string') return data.message;

  return err.message || fallback;
}