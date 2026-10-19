"""
Тесты Swi (bound water) и Archie (Sw + R0).

ВХОД — готовые pd.Series (Vsh, PHI, Rt), без самосчёта.
"""
import numpy as np
import pandas as pd
import pytest

from app.services.petrophysics.swi import swi_bound_water
from app.services.petrophysics.archie import sw_archie, r0_archie


# ============================================================================
# Swi — bound water
# ============================================================================

class TestSwiBoundWater:
    def test_clean_sand(self):
        """Vsh=0, PHI=0.2 → Swi = 0.015 / 0.2 = 0.075."""
        vsh = pd.Series([0.0], index=[2000.0])
        phi = pd.Series([0.2], index=[2000.0])
        result = swi_bound_water(vsh, phi)
        assert result.iloc[0] == pytest.approx(0.075, abs=1e-3)

    def test_shale(self):
        """Vsh=1, PHI=0.1 → Swi = 0.215/0.1 = 2.15 → clip 1.0."""
        vsh = pd.Series([1.0])
        phi = pd.Series([0.1])
        result = swi_bound_water(vsh, phi)
        assert result.iloc[0] == pytest.approx(1.0, abs=1e-3)

    def test_mid_case(self):
        """Vsh=0.5, PHI=0.15 → Swi = (0.015+0.1)/0.15 = 0.7667."""
        vsh = pd.Series([0.5])
        phi = pd.Series([0.15])
        result = swi_bound_water(vsh, phi)
        assert result.iloc[0] == pytest.approx(0.7667, abs=1e-3)

    def test_clip_upper(self):
        """Vsh=0, PHI очень маленький → Swi > 1 → clip 1.0."""
        vsh = pd.Series([0.0])
        phi = pd.Series([0.005])
        result = swi_bound_water(vsh, phi)
        assert result.iloc[0] == pytest.approx(1.0, abs=1e-3)

    def test_clip_lower(self):
        """Swi меньше swi_min → clip."""
        vsh = pd.Series([0.0])
        phi = pd.Series([0.5])
        result = swi_bound_water(vsh, phi, swi_min=0.05)
        assert result.iloc[0] == pytest.approx(0.05, abs=1e-3)

    def test_phi_zero_returns_clipped(self):
        """PHI=0 → inf → clip 1.0."""
        vsh = pd.Series([0.0])
        phi = pd.Series([0.0])
        result = swi_bound_water(vsh, phi)
        assert result.iloc[0] == pytest.approx(1.0, abs=1e-3)

    def test_nan_preserved(self):
        vsh = pd.Series([0.0, np.nan, 0.0])
        phi = pd.Series([0.2, 0.2, np.nan])
        result = swi_bound_water(vsh, phi)
        assert not pd.isna(result.iloc[0])
        assert pd.isna(result.iloc[1])
        assert pd.isna(result.iloc[2])

    def test_invalid_bounds(self):
        with pytest.raises(ValueError, match="swi_min must be less"):
            swi_bound_water(pd.Series([0.0]), pd.Series([0.2]), swi_min=1.0, swi_max=0.5)


# ============================================================================
# Sw — Archie
# ============================================================================

class TestSwArchie:
    def test_water_saturated(self):
        """PHI=0.2, Rt = Rw / PHI^m = 0.1 / 0.04 = 2.5 → Sw = 1.0."""
        phi = pd.Series([0.2])
        rt = pd.Series([2.5])
        result = sw_archie(phi, rt, a=1.0, m=2.0, n=2.0, rw=0.1)
        assert result.iloc[0] == pytest.approx(1.0, abs=1e-3)

    def test_half_saturated(self):
        """PHI=0.2, Rt = 0.1 / (0.04*0.25) = 10 → Sw = 0.5."""
        phi = pd.Series([0.2])
        rt = pd.Series([10.0])
        result = sw_archie(phi, rt, a=1.0, m=2.0, n=2.0, rw=0.1)
        assert result.iloc[0] == pytest.approx(0.5, abs=1e-3)

    def test_high_rt_low_sw(self):
        """Rt = 1000 → Sw = 0.05."""
        phi = pd.Series([0.2])
        rt = pd.Series([1000.0])
        result = sw_archie(phi, rt, a=1.0, m=2.0, n=2.0, rw=0.1)
        assert result.iloc[0] == pytest.approx(0.05, abs=1e-3)

    def test_zero_rt_nan(self):
        phi = pd.Series([0.2])
        rt = pd.Series([0.0])
        result = sw_archie(phi, rt)
        assert pd.isna(result.iloc[0])

    def test_zero_phi_nan(self):
        phi = pd.Series([0.0])
        rt = pd.Series([10.0])
        result = sw_archie(phi, rt)
        assert pd.isna(result.iloc[0])

    def test_clip_low_rt(self):
        """Rt=0.01, PHI=0.2 → Sw = 15.8 → clip 1.0."""
        phi = pd.Series([0.2])
        rt = pd.Series([0.01])
        result = sw_archie(phi, rt, rw=0.1, m=2.0, n=2.0)
        assert result.iloc[0] == pytest.approx(1.0, abs=1e-3)

    def test_invalid_n(self):
        with pytest.raises(ValueError, match="n must be positive"):
            sw_archie(pd.Series([0.2]), pd.Series([10.0]), n=0.0)

    def test_nan_preserved(self):
        phi = pd.Series([0.2, np.nan, 0.2])
        rt = pd.Series([10.0, 10.0, np.nan])
        result = sw_archie(phi, rt)
        assert not pd.isna(result.iloc[0])
        assert pd.isna(result.iloc[1])
        assert pd.isna(result.iloc[2])


# ============================================================================
# R0 — overlay
# ============================================================================

class TestR0Archie:
    def test_r0_basic(self):
        """R0 = a*Rw / PHI^m = 0.1 / 0.04 = 2.5."""
        phi = pd.Series([0.2])
        result = r0_archie(phi, a=1.0, m=2.0, rw=0.1)
        assert result.iloc[0] == pytest.approx(2.5, abs=1e-3)

    def test_r0_zero_phi_nan(self):
        phi = pd.Series([0.0])
        result = r0_archie(phi)
        assert pd.isna(result.iloc[0])

    def test_r0_equals_rt_at_sw_1(self):
        """При Sw=1 R0 == Rt."""
        phi = pd.Series([0.2])
        r0 = r0_archie(phi, rw=0.1, m=2.0).iloc[0]
        rt_sw1 = 0.1 / (0.2 ** 2)
        assert r0 == pytest.approx(rt_sw1, abs=1e-6)

    def test_r0_nan_preserved(self):
        phi = pd.Series([0.2, np.nan])
        result = r0_archie(phi)
        assert not pd.isna(result.iloc[0])
        assert pd.isna(result.iloc[1])