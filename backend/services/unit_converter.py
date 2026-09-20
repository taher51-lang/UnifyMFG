# backend/services/unit_converter.py
# Single source of truth for unit conversion on the backend.
# Import this wherever unit conversion is needed — never define it inline.

# Conversion factors: multiply qty by this to go from (from_unit) → (to_unit)
_CONVERSIONS: dict[tuple, float] = {
    ("kg",  "g"):   1_000,
    ("kg",  "mg"):  1_000_000,
    ("kg",  "lb"):  2.20462,
    ("g",   "kg"):  0.001,
    ("g",   "mg"):  1_000,
    ("g",   "oz"):  0.035274,
    ("mg",  "g"):   0.001,
    ("mg",  "kg"):  0.000_001,
    ("L",   "ml"):  1_000,
    ("ml",  "L"):   0.001,
    ("oz",  "g"):   28.3495,
    ("lb",  "kg"):  0.453592,
}


def convert_qty(qty: float, from_unit: str, to_unit: str) -> float | None:
    """
    Convert a quantity between units.
    Returns the converted value, or None if no conversion is defined.
    """
    if from_unit == to_unit:
        return round(float(qty), 6)
    factor = _CONVERSIONS.get((from_unit, to_unit))
    if factor is None:
        return None
    return round(float(qty) * factor, 6)


def can_convert(from_unit: str, to_unit: str) -> bool:
    """Return True if a direct conversion path exists between two units."""
    return from_unit == to_unit or (from_unit, to_unit) in _CONVERSIONS
