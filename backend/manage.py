#!/usr/bin/env python
"""Standalone dev server entry point for org-app.

In an assembly deployment the host project provides its own settings and URL
config; this manage.py is only used when running org-app on its own.
"""
import os
import sys


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dev_project.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
