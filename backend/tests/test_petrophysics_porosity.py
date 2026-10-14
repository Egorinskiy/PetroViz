"""
Тесты формул пористости.

Эталонные значения рассчитаны вручную:
    PHID = (ρm − ρb) / (ρm − ρf)
    PHIS = (DT − DTm) / (DTf − DTm)
"""
import numpy as np
import pandas as pd
import pytest

from app.services.petrophysics.porosity import (
    porosity_density,
    porosity_neutron,
    porosity_sonic,
)


# ============================================================================
# PHID — плотностная пористость
# ============================================================================

class TestPorosityDensity:
    def test_sandstone_water_basic(self):
        """ρm=2.65, ρf=1.0 → 1/1.65 ≈ 0.606 на единицу разности."""
        rhob = pd.Series([2.65, 2.35, 2.05])
        result = porosity_density(rhob, rho_matrix=2.65, rho_fluid=1.0)

        # 2.65 → 0
        # 2.35 → 0.30/1.65 = 0.181818
        # 2.05 → 0.60/1.65 = 0.363636
        assert result.iloc[0] == pytest.approx(0.0, abs=1e-4)
        assert result.iloc[1] == pytest.approx(0.181818, abs=1e-4)
        assert result.iloc[2] == pytest.approx(0.363636, abs=1e-4)

    def test_limestone_matrix(self):
        """Известняк: ρm=2.71."""
        rhob = pd.Series([2.71, 2.41])
        result = porosity_density(rhob, rho_matrix=2.71, rho_fluid=1.0)
        # 2.41 → 0.30/1.71 = 0.175439
        assert result.iloc[0] == pytest.approx(0.0, abs=1e-4)
        assert result.iloc[1] == pytest.approx(0.175439, abs=1e-4)

    def test_clip_upper_bound(self):
        """Очень низкая плотность → обрезка до PHI_MAX=0.6."""
        rhob = pd.Series([1.0])  # газ
        result = porosity_density(rhob, rho_matrix=2.65, rho_fluid=1.0)
        # (2.65-1.0)/1.65 = 1.0 → clip to 0.6
        assert result.iloc[0] == pytest.approx(0.6, abs=1e-4)

    def test_clip_lower_bound(self):
        """Плотность выше матрицы → обрезка до 0."""
        rhob = pd.Series([3.0])
        result = porosity_density(rhob, rho_matrix=2.65, rho_fluid=1.0)
        # (2.65-3.0)/1.65 = -0.212 → clip to 0
        assert result.iloc[0] == pytest.approx(0.0, abs=1e-4)

    def test_nan_preserved(self):
        """NaN во входе → NaN в выходе."""
        rhob = pd.Series([2.35, np.nan, 2.05])
        result = porosity_density(rhob)
        assert not pd.isna(result.iloc[0])
        assert pd.isna(result.iloc[1])
        assert not pd.isna(result.iloc[2])

    def test_invalid_matrix_less_than_fluid(self):
        """ρm <= ρf → ошибка."""
        with pytest.raises(ValueError, match="rho_matrix must be greater"):
            porosity_density(pd.Series([2.35]), rho_matrix=1.0, rho_fluid=1.5)


# ============================================================================
# PHIN — нейтронная пористость
# ============================================================================

class TestPorosityNeutron:
    def test_passthrough(self):
        """NPHI без изменений."""
        nphi = pd.Series([0.0, 0.15, 0.30, 0.5])
        result = porosity_neutron(nphi)
        pd.testing.assert_series_equal(result, nphi)

    def test_negative_preserved(self):
        """Отрицательные NPHI (газовый эффект) сохраняются."""
        nphi = pd.Series([-0.05, 0.10])
        result = porosity_neutron(nphi)
        assert result.iloc[0] == pytest.approx(-0.05, abs=1e-4)

    def test_nan_preserved(self):
        nphi = pd.Series([0.15, np.nan, 0.30])
        result = porosity_neutron(nphi)
        assert pd.isna(result.iloc[1])

    def test_copy_not_view(self):
        """Возвращаем копию, не view (иначе мутации входного повлияют)."""
        nphi = pd.Series([0.15, 0.30])
        result = porosity_neutron(nphi)
        nphi.iloc[0] = 999.0
        assert result.iloc[0] != 999.0


# ============================================================================
# PHIS — акустическая пористость (Wyllie)
# ============================================================================

class TestPorositySonic:
    def test_sandstone_water_basic(self):
        """DTm=55.5, DTf=189 → Δ=133.5 на единицу."""
        dtc = pd.Series([55.5, 100.0, 150.0])
        result = porosity_sonic(dtc, dt_matrix=55.5, dt_fluid=189.0)

        # 55.5 → 0
        # 100 → 44.5/133.5 = 0.333333
        # 150 → 94.5/133.5 = 0.707865 → clip to 0.6
        assert result.iloc[0] == pytest.approx(0.0, abs=1e-4)
        assert result.iloc[1] == pytest.approx(0.333333, abs=1e-4)
        assert result.iloc[2] == pytest.approx(0.6, abs=1e-4)

    def test_limestone_matrix(self):
        """Известняк: DTm=47.5."""
        dtc = pd.Series([47.5, 100.0])
        result = porosity_sonic(dtc, dt_matrix=47.5, dt_fluid=189.0)
        # (100-47.5)/141.5 = 0.371025
        assert result.iloc[0] == pytest.approx(0.0, abs=1e-4)
        assert result.iloc[1] == pytest.approx(0.371025, abs=1e-4)

    def test_clip_lower_bound(self):
        """DTc < DTm → обрезка до 0."""
        dtc = pd.Series([40.0])
        result = porosity_sonic(dtc, dt_matrix=55.5, dt_fluid=189.0)
        assert result.iloc[0] == pytest.approx(0.0, abs=1e-4)

    def test_nan_preserved(self):
        dtc = pd.Series([100.0, np.nan, 150.0])
        result = porosity_sonic(dtc)
        assert pd.isna(result.iloc[1])

    def test_invalid_fluid_less_than_matrix(self):
        with pytest.raises(ValueError, match="dt_fluid must be greater"):
            porosity_sonic(pd.Series([100.0]), dt_matrix=189.0, dt_fluid=55.5)