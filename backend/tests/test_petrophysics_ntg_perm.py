"""
Тесты NTG (cutoff) и Permeability (Timur-Coates).
"""
import numpy as np
import pandas as pd
import pytest

from app.services.petrophysics.ntg import ntg_cutoff
from app.services.petrophysics.permeability import perm_timur_coates


# ============================================================================
# NTG — cutoff-анализ
# ============================================================================

class TestNtgCutoff:
    def test_all_net(self):
        """Все три кривые в норме → NTG=1."""
        vsh = pd.Series([0.2, 0.3])
        phi = pd.Series([0.15, 0.20])
        swi = pd.Series([0.3, 0.5])
        result = ntg_cutoff(vsh, phi, swi)
        assert (result == 1.0).all()

    def test_shaly_not_net(self):
        """Vsh=0.5 > cutoff 0.4 → не коллектор."""
        vsh = pd.Series([0.5])
        phi = pd.Series([0.2])
        swi = pd.Series([0.3])
        result = ntg_cutoff(vsh, phi, swi)
        assert result.iloc[0] == 0.0

    def test_low_phi_not_net(self):
        """PHI=0.05 < cutoff 0.08 → не коллектор."""
        vsh = pd.Series([0.2])
        phi = pd.Series([0.05])
        swi = pd.Series([0.3])
        result = ntg_cutoff(vsh, phi, swi)
        assert result.iloc[0] == 0.0

    def test_high_swi_not_net(self):
        """Swi=0.9 > cutoff 0.85 → не коллектор."""
        vsh = pd.Series([0.2])
        phi = pd.Series([0.2])
        swi = pd.Series([0.9])
        result = ntg_cutoff(vsh, phi, swi)
        assert result.iloc[0] == 0.0

    def test_boundary_exactly_at_cutoff(self):
        """Vsh=0.4, PHI=0.08, Swi=0.85 — строгие неравенства, поэтому НЕ коллектор."""
        vsh = pd.Series([0.4])
        phi = pd.Series([0.08])
        swi = pd.Series([0.85])
        result = ntg_cutoff(vsh, phi, swi)
        assert result.iloc[0] == 0.0

    def test_custom_cutoffs(self):
        """Кастомные отсечки."""
        vsh = pd.Series([0.3])
        phi = pd.Series([0.15])
        swi = pd.Series([0.5])
        result = ntg_cutoff(vsh, phi, swi, vsh_cutoff=0.2)
        assert result.iloc[0] == 0.0  # 0.3 > 0.2

    def test_nan_propagates(self):
        """NaN в любом входе → NaN в выходе."""
        vsh = pd.Series([0.2, np.nan, 0.2])
        phi = pd.Series([0.2, 0.2, np.nan])
        swi = pd.Series([0.3, 0.3, 0.3])
        result = ntg_cutoff(vsh, phi, swi)
        assert result.iloc[0] == 1.0
        assert pd.isna(result.iloc[1])
        assert pd.isna(result.iloc[2])

    def test_invalid_cutoff(self):
        with pytest.raises(ValueError, match="vsh_cutoff must be in"):
            ntg_cutoff(
                pd.Series([0.2]), pd.Series([0.2]), pd.Series([0.3]),
                vsh_cutoff=1.5,
            )


# ============================================================================
# Permeability — Timur-Coates
# ============================================================================

class TestPermTimurCoates:
    def test_basic(self):
        """PHI=0.2, Swi=0.3, C=10000, a=4.5, b=2.0."""
        phi = pd.Series([0.2])
        swi = pd.Series([0.3])
        result = perm_timur_coates(phi, swi)
        # K = 10000 * 0.2^4.5 / 0.3^2
        # 0.2^4.5 = 0.2^4 * sqrt(0.2) = 0.0016 * 0.4472 = 0.0007155
        # 0.3^2 = 0.09
        # K = 10000 * 0.0007155 / 0.09 = 79.5
        assert result.iloc[0] == pytest.approx(79.5, abs=1.0)

    def test_zero_phi_nan(self):
        phi = pd.Series([0.0])
        swi = pd.Series([0.3])
        result = perm_timur_coates(phi, swi)
        assert pd.isna(result.iloc[0])

    def test_zero_swi_nan(self):
        phi = pd.Series([0.2])
        swi = pd.Series([0.0])
        result = perm_timur_coates(phi, swi)
        assert pd.isna(result.iloc[0])

    def test_nan_propagates(self):
        phi = pd.Series([0.2, np.nan, 0.2])
        swi = pd.Series([0.3, 0.3, np.nan])
        result = perm_timur_coates(phi, swi)
        assert not pd.isna(result.iloc[0])
        assert pd.isna(result.iloc[1])
        assert pd.isna(result.iloc[2])

    def test_negative_params_raise(self):
        with pytest.raises(ValueError, match="c must be positive"):
            perm_timur_coates(pd.Series([0.2]), pd.Series([0.3]), c=0.0)


# ============================================================================
# Integration — NTG + Perm в цепочке (Vsh → PHI → Swi → NTG/Perm)
# ============================================================================

def test_ntg_perm_chain():
    """Имитация цепочки: чистый песок → коллектор → высокая K.
    Глина → не коллектор, K=NaN или низкая."""
    # Чистый песок (2 точки)
    # Глина (2 точки)
    vsh = pd.Series([0.1, 0.15, 0.6, 0.7])
    phi = pd.Series([0.20, 0.18, 0.05, 0.03])
    swi = pd.Series([0.25, 0.30, 0.9, 0.95])

    ntg = ntg_cutoff(vsh, phi, swi)
    # Чистые пески: коллекторы; глины: нет
    assert ntg.iloc[0] == 1.0
    assert ntg.iloc[1] == 1.0
    assert ntg.iloc[2] == 0.0
    assert ntg.iloc[3] == 0.0

    perm = perm_timur_coates(phi, swi)
    # Чистые пески: K > 0; глины: K > 0 но малая
    assert perm.iloc[0] > 0
    assert perm.iloc[1] > 0
    # K глины << K песка (порядки величины)
    assert perm.iloc[2] < perm.iloc[0] * 0.01