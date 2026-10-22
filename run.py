from datetime import datetime, timedelta
import copy


def calculate_safe_increment(current_weight: float, target_weight: float) -> float:
    """
    Рассчитывает безопасный шаг прироста (в км за тренировку).
    Чем больше избыточный вес, тем плавнее прирост, чтобы уберечь суставы.
    """
    weight_diff = max(0.0, current_weight - target_weight)

    # При высоком избыточном весе берем осторожный шаг (например, +300m за тренировку)
    if current_weight > 100:
        base_inc = 0.35
    elif current_weight > 85:
        base_inc = 0.50
    else:
        base_inc = 0.75

    # Корректируем шаг в зависимости от того, насколько далеко цель по весу
    return max(0.2, base_inc - (weight_diff * 0.01))


def estimate_calories_burned(distance_km: float, weight_kg: float) -> float:
    """ Приблизительный расчет сожженных ккал при беге/активной ходьбе. """
    return round(distance_km * weight_kg * 1.03, 1)


def generate_schedule(
        start_km: float,
        final_km: float,
        interval_days: int = 2,
        current_weight: float = 85.0,
        target_weight: float = 75.0,
        start_date: datetime = None,
        is_cumulative_target: bool = False
):
    """
    Генерирует физиологичный план тренировок для похудения.

    :param start_km: Старт (например, 1.0 км)
    :param final_km: Финишная цель (например, 123 км суммарно или разово)
    :param interval_days: Интервал между тренировками в днях (2 = через день)
    :param current_weight: Текущий вес пользователя (кг)
    :param target_weight: Желаемый вес (кг)
    :param is_cumulative_target: True если 123 км - это сумма всех тренировок,
                                False если 123 км - цель за одну тренировку
    """
    schedule = []
    current_date = start_date or datetime.now()

    inc_km = calculate_safe_increment(current_weight, target_weight)

    curr_target_km = start_km
    total_accumulated_km = 0.0
    curr_weight = current_weight

    # Вес убывает пропорционально пробегу (прибл. 7700 ккал = 1 кг жира)
    # 1 км при весе W дает W ккал.
    workout_count = 0

    while True:
        workout_count += 1
        current_date += timedelta(days=interval_days)

        # Периодическая разгрузка (каждая 4-я тренировка - разгрузочная -25% к расстоянию)
        if workout_count % 4 == 0:
            actual_km = round(max(start_km, curr_target_km * 0.75), 2)
        else:
            actual_km = round(curr_target_km, 2)
            # Увеличиваем целевой км для следующей обычной тренировки
            curr_target_km += inc_km

        # Расчет сжигания калорий и гипотетической потери веса
        cals = estimate_calories_burned(actual_km, curr_weight)
        weight_loss = cals / 7700.0
        curr_weight = max(target_weight, curr_weight - weight_loss)

        total_accumulated_km += actual_km

        schedule.append({
            'workout_num': workout_count,
            'date': current_date.strftime('%Y.%m.%d'),
            'target': actual_km,
            'estimated_cals': cals,
            'est_weight_after': round(curr_weight, 2),
            'cumulative_km': round(total_accumulated_km, 2),
            'status': 'pending',
            'result': None
        })

        # Проверка условия завершения
        if is_cumulative_target:
            if total_accumulated_km >= final_km:
                break
        else:
            if actual_km >= final_km:
                break

        # Страховка от бесконечного цикла
        if workout_count > 1000:
            break

    return schedule


def recalculate_schedule(
        curr_schedule: list,
        target_final: float,
        changed_index: int,
        new_date_str: str = None,
        new_target: float = None,
        new_actual_weight: float = None,
        interval_days: int = 2,
        target_weight: float = 75.0,
        is_cumulative_target: bool = False
):
    """
    Перерасчитывает расписание с момента измененной тренировки.
    """
    schedule = copy.deepcopy(curr_schedule)

    if new_date_str:
        schedule[changed_index]['date'] = new_date_str
    if new_target is not None:
        schedule[changed_index]['target'] = round(max(0.1, new_target), 2)

    # Оставляем выполненные/прошедшие элементы до измененного включительно
    new_schedule = schedule[:changed_index + 1]

    # Берем текущий актуальный вес и накапливаемый километраж
    last_item = new_schedule[-1]
    curr_weight = new_actual_weight or last_item.get('est_weight_after', 85.0)
    total_accumulated_km = sum(item['target'] for item in new_schedule)

    inc_km = calculate_safe_increment(curr_weight, target_weight)
    curr_target_km = last_item['target']
    last_date = datetime.strptime(last_item['date'], '%Y.%m.%d')
    workout_count = len(new_schedule)

    # Догенерируем оставшийся план
    while True:
        # Проверка условий выхода
        if is_cumulative_target and total_accumulated_km >= target_final:
            break
        if not is_cumulative_target and curr_target_km >= target_final:
            break

        workout_count += 1
        last_date += timedelta(days=interval_days)

        if workout_count % 4 == 0:
            actual_km = round(max(1.0, curr_target_km * 0.75), 2)
        else:
            curr_target_km += inc_km
            actual_km = round(curr_target_km, 2)

        cals = estimate_calories_burned(actual_km, curr_weight)
        weight_loss = cals / 7700.0
        curr_weight = max(target_weight, curr_weight - weight_loss)
        total_accumulated_km += actual_km

        new_schedule.append({
            'workout_num': workout_count,
            'date': last_date.strftime('%Y.%m.%d'),
            'target': actual_km,
            'estimated_cals': cals,
            'est_weight_after': round(curr_weight, 2),
            'cumulative_km': round(total_accumulated_km, 2),
            'status': 'pending',
            'result': None
        })

        if workout_count > 1000:
            break

    return new_schedule