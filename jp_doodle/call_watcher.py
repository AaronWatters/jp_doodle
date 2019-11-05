"""
Watch the call sequence for a pattern
"""

import sys

class ProfileRecord:

    def __init__(self, in_frame, event_name, other):
        self.in_frame = in_frame
        self.event_name = event_name
        self.other = other

    def __repr__(self):
        n = self.code_name()
        l = self.frame_arg_list()
        e = self.event_name
        o = self.other
        return "%s: %s%s: %s" % (e, n, tuple(l), o)

    def code_name(self):
        return self.in_frame.f_code.co_name

    def arg_names(self):
        code = self.in_frame.f_code
        varnames = code.co_varnames
        argcount = code.co_argcount
        return varnames[:argcount]

    def frame_arg_list(self):
        frame = self.in_frame
        code = frame.f_code
        locals = frame.f_locals
        names = self.arg_names()
        return [locals[n] for n in names]

    def summary(self):
        result = [
            self.event_name,
            self.code_name(),
            self.frame_arg_list()
        ]
        if self.other is not None:
            result.append(self.other)
        return result


def watch_methods(for_object, events="any", name=None):
    return CallWatcherContextManager(event_match=events, name_match=name, arg_match=(for_object,))

def watch_for_function_name(name, events="any"):
    return CallWatcherContextManager(event_match=events, name_match=name, arg_match=())


class CallWatcherContextManager:

    def __init__(self, event_match=("call",), name_match=None, arg_match=()):
        self.event_match = event_match
        self.name_match = name_match
        self.arg_match = arg_match
        self.matches = []

    def repr(self):
        L = ["match" + repr((self.event_match, self.name_match, self.arg_match))]
        for x in self.matches:
            L.append(repr(x))
        return "\n".join(L)

    def __enter__(self):
        self.saved_args = []
        sys.setprofile(self.save_args)

    def __exit__(self, *ignored_arguments):
        sys.setprofile(None)
        for args in self.saved_args:
            self.check_match(*args)

    def save_args(self, *args):
        self.saved_args.append(args)

    def check_match(self, frame, event, other):
        if event in self.event_match or self.event_match == "any":
            R = ProfileRecord(frame, event, other)
            nm = self.name_match
            am = self.arg_match
            if not nm or nm == R.code_name():
                args_ok = True
                if am:
                    args = R.frame_arg_list()
                    for (i, argtest) in enumerate(am):
                        if len(args) <= i:
                            args_ok = False
                        else:
                            arg = args[i]
                            if arg is not argtest:    # ???? identity test here, ok?
                                args_ok = False
                if args_ok:
                    #Sprint ("DEBUG accepting args:", args, am)
                    self.matches.append(R)

    def summary(self):
        return [x.summary() for x in self.matches]

    def examine(self):
        from jp_doodle import examine
        return examine.examine(self.summary())

def calltest1(a, b):
    c = a + b
    return (c, a-b)

def calltest2(x, y):
    return calltest1(x * y, y)

def test():
    C = CallWatcherContextManager(event_match=("call", "return"), name_match=None, arg_match=(6,))
    with C:
        calltest2(6,7)
    print (C.repr())

if __name__ == "__main__":
    test()
