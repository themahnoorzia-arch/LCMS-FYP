"""Shared validation rules for identity fields (CNIC, phone, DOB, email).

Used by both signup and every profile-edit endpoint, so editing a profile
can never bypass a rule that was enforced at signup — one set of rules,
enforced everywhere the field can be written.
"""
import re
import datetime


def normalize_digits(value):
    """Strip everything but digits from a CNIC/phone string."""
    return re.sub(r"\D", "", value or "")


def is_valid_cnic(cnic_digits):
    """Pakistani CNIC: exactly 13 digits, digits only."""
    return len(cnic_digits) == 13 and cnic_digits.isdigit()


def is_valid_pk_phone(phone_digits):
    """Pakistani mobile number: exactly 11 digits, starting with 03."""
    return (
        len(phone_digits) == 11
        and phone_digits.isdigit()
        and phone_digits.startswith("03")
    )


def is_valid_email(email):
    return bool(email) and bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


def is_adult_dob(dob_str):
    """At least 18 years old, and not a birthdate in the future."""
    try:
        dob = datetime.datetime.strptime(dob_str, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return False
    today = datetime.date.today()
    if dob > today:
        return False
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age >= 18
