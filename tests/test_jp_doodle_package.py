"""Test the jp_doodle package."""


def test_version_is_string():
    import jp_doodle
    assert isinstance(jp_doodle.__version__, str)
