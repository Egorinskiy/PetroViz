"""
Диагностика: почему vshale_neutron_density возвращает пусто.
"""
from pathlib import Path

from app.services.las_service import parse_las
from app.services.petrophysics.vshale import vshale_neutron_density

path = Path("sample_data/real_well.las")
if not path.exists():
    print(f"❌ Нет файла: {path}")
    raise SystemExit(1)

data = parse_las(path.read_bytes(), path.name)
df = data["df"]

print("=" * 60)
print(f"Колонки ({len(df.columns)}):", list(df.columns)[:30])
print()

# Ищем RHOB и NPHI
has_rhob = "RHOB" in df.columns
has_nphi = "NPHI" in df.columns
print(f"RHOB в колонках: {has_rhob}")
print(f"NPHI в колонках: {has_nphi}")

if not (has_rhob and has_nphi):
    # Может, они называются иначе?
    for col in df.columns:
        if col.upper() in ("RHOB", "RHOZ", "DEN", "ZDEN"):
            print(f"  Найден RHOB как: {col}")
        if col.upper() in ("NPHI", "CNL", "TNPH", "NNK"):
            print(f"  Найден NPHI как: {col}")
    raise SystemExit(1)

print()
print("=" * 60)
print("RHOB stats:")
print(f"  min={df['RHOB'].min()}, max={df['RHOB'].max()}")
print(f"  NaN count: {df['RHOB'].isna().sum()} из {len(df)}")
print()
print("NPHI stats:")
print(f"  min={df['NPHI'].min()}, max={df['NPHI'].max()}")
print(f"  NaN count: {df['NPHI'].isna().sum()} из {len(df)}")
print()

# Проверяем ручной расчёт
phid = (2.65 - df["RHOB"]) / (2.65 - 1.0)
print(f"PHID range: {phid.min()} … {phid.max()}")
print(f"PHID valid: {phid.notna().sum()}")

delta = df["NPHI"] - phid
print(f"Delta range: {delta.min()} … {delta.max()}")
print(f"Delta valid: {delta.notna().sum()}")

delta_clean = 0.28 - 0.30   # -0.02
delta_shale = 0.25 - 0.10   # 0.15
print(f"delta_clean={delta_clean}, delta_shale={delta_shale}")

igr = (delta - delta_clean) / (delta_shale - delta_clean)
result = igr.clip(lower=0.0, upper=1.0)

print()
print("=" * 60)
print("Результат vshale_neutron_density:")
print(f"  valid: {result.notna().sum()} из {len(result)}")
print(f"  min={result.min()}, max={result.max()}")
print(f"  первые 10 значений: {result.head(10).tolist()}")