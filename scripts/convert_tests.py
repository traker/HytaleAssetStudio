"""Convert backend tests from unittest to pytest."""
from __future__ import annotations
import re
from pathlib import Path

TEST_DIR = Path(__file__).parent.parent / "backend" / "tests"


def convert(src: str) -> str:
    # 1) Remove "import unittest"
    src = re.sub(r'^import unittest\n', '', src, flags=re.MULTILINE)
    # 2) Add "import pytest" before the first "from backend." import
    if 'import pytest' not in src:
        src = re.sub(r'(from backend\.)', r'import pytest\n\1', src, count=1)
    # 3) Remove unittest.TestCase parent
    src = re.sub(r'\(unittest\.TestCase\)', '', src)
    # 4) setUp -> setup_method, tearDown -> teardown_method
    src = src.replace('def setUp(', 'def setup_method(')
    src = src.replace('def tearDown(', 'def teardown_method(')
    # 5) assertRaises context manager
    src = re.sub(r'\bself\.assertRaises\((.+?)\) as ctx\b', r'pytest.raises(\1) as exc_info', src)
    src = src.replace('ctx.exception.', 'exc_info.value.')

    # 6) Convert all self.assertXXX(...) calls, including multi-line ones
    # We collect all occurrences by finding the call span, then replace in reverse order
    src = _convert_assert_calls(src)

    # 7) Remove if __name__ == "__main__": block
    src = re.sub(r'\nif __name__ == ["\']__main__["\']:\n    unittest\.main\(\)\n?', '', src)
    return src


def _collect_call(src: str, start: int) -> tuple[int, int, str]:
    """Return (end_exclusive, full_text, args_text) for the call starting at 'start'.
    'start' should point to the opening '(' of the call arguments.
    Returns (end_exclusive, args_content).
    """
    depth = 0
    i = start
    while i < len(src):
        ch = src[i]
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                return i + 1, src[start + 1:i]
        i += 1
    return len(src), src[start + 1:]


def _split_top_level(args: str) -> list[str]:
    """Split args string on top-level commas."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for ch in args:
        if ch in '([{':
            depth += 1
            current.append(ch)
        elif ch in ')]}':
            depth -= 1
            current.append(ch)
        elif ch == ',' and depth == 0:
            parts.append(''.join(current).strip())
            current = []
        else:
            current.append(ch)
    if current:
        parts.append(''.join(current).strip())
    return parts


def _convert_assert_calls(src: str) -> str:
    PATTERNS = {
        'assertEqual': lambda indent, args: f"{indent}assert {args[0]} == {args[1]}",
        'assertTrue': lambda indent, args: f"{indent}assert {args[0]}",
        'assertFalse': lambda indent, args: f"{indent}assert not {args[0]}",
        'assertIn': lambda indent, args: f"{indent}assert {args[0]} in {args[1]}",
        'assertNotIn': lambda indent, args: f"{indent}assert {args[0]} not in {args[1]}",
    }
    # Find all occurrences in reverse order to safely replace
    replacements: list[tuple[int, int, str]] = []
    for method, builder in PATTERNS.items():
        pattern = re.compile(r'^(\s*)self\.' + method + r'\(', re.MULTILINE)
        for m in pattern.finditer(src):
            indent = m.group(1)
            open_paren = m.end() - 1  # position of '('
            end, args_text = _collect_call(src, open_paren)
            # Normalize args_text: collapse whitespace/newlines between arguments
            args_parts = _split_top_level(args_text)
            # Normalize each part (collapse internal newlines + extra spaces)
            args_parts = [re.sub(r'\s+', ' ', p.strip()) for p in args_parts]
            # Build the replacement
            replacement = builder(indent, args_parts)
            # The full original span starts at the beginning of the indented line
            line_start = m.start()
            # End: skip trailing whitespace on last line up to newline
            replacements.append((line_start, end, replacement))

    # Apply in reverse order
    for start, end, repl in sorted(replacements, reverse=True):
        src = src[:start] + repl + src[end:]
    return src


def main() -> None:
    for path in sorted(TEST_DIR.glob('test_*.py')):
        original = path.read_text(encoding='utf-8')
        converted = convert(original)
        remaining = re.findall(r'self\.assert\w+', converted)
        if remaining:
            print(f"WARNING {path.name}: {len(remaining)} unconverted assertions: {remaining[:3]}")
        else:
            print(f"OK      {path.name}")
        path.write_text(converted, encoding='utf-8')
    print("Done.")


if __name__ == '__main__':
    main()
