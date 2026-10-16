def kw(*, a, b):
    print(a, b)


try:
    kw(1)
except TypeError as _ex:
    print(_ex.args)