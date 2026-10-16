from datetime import datetime, timedelta


AUTOLOGIN = '1'
MAX_GROWTH_FACTOR = 2


def generate_schedule(start: float, final: float, interval: int, factor: float = 1.2, start_date=None):
    schedule = []
    current_date = start_date or datetime.now()
    current_target = start

    while current_target < final:
        current_date += timedelta(days=interval)
        current_target = round(min(final, max(0.1, current_target * factor)), 2)

        schedule.append({
            'date': current_date.strftime('%Y.%m.%d'),
            'target': current_target,
            'status': 'pending',
            'result': None
        })

    return schedule

def _gn(fnc):
    def wrapper(*args, **kwargs):
        g = fnc(*args, **kwargs)
        return [_i for _i in g]
    return wrapper


import copy

def recalculate_schedule(curr_schedule, target_final, changed_index: int, new_date_str: str = None, new_target: float = None,
                         interval: int = 2, factor: float = 1.2):
    # Делаем глубокую копию, чтобы не менять исходный dict по ссылке во время вычислений
    schedule = copy.deepcopy(curr_schedule)
    final_target = target_final

    if new_date_str:
        schedule[changed_index]['date'] = new_date_str
    if new_target is not None:
        # Если нужно разрешить целевое значение выше target_final, уберите min(final_target, ...)
        schedule[changed_index]['target'] = round(max(0.1, new_target), 2)

    new_schedule = schedule[:changed_index + 1]

    for i in range(changed_index + 1, len(curr_schedule)):
        prev_item = new_schedule[-1]
        prev_date = datetime.strptime(prev_item['date'], '%Y.%m.%d')
        next_date = prev_date + timedelta(days=interval)

        next_target = round(min(final_target, prev_item['target'] * factor), 2)

        new_schedule.append({
            'date': next_date.strftime('%Y.%m.%d'),
            'target': next_target,
            'status': curr_schedule[i].get('status', 'pending'),
            'result': curr_schedule[i].get('result', None)
        })

        if next_target >= final_target:
            break

    last_item = new_schedule[-1]
    if last_item['target'] < final_target:
        last_date = datetime.strptime(last_item['date'], '%Y.%m.%d')
        extra_schedule = generate_schedule(
            start=last_item['target'],
            final=final_target,
            interval=interval,
            factor=factor,
            start_date=last_date
        )
        new_schedule.extend(extra_schedule)

    return new_schedule

@_gn
def get_next_scheduled_workout(user, l=1):
    c = 0
    for item in schedule:
        if c == l:
            return

        if item['status'] == 'pending':
            c += 1
            yield item