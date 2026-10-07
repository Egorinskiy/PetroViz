import lasio

las = lasio.read("Appendix/mnemonic_good.las")  # укажи путь к скачанному файлу

print("Секции:", las.sections.keys())
print("Скважина:", las.well.WELL.value if 'WELL' in las.well else "N/A")
print("Кривые:")
for curve in las.curves:
    print(f"  {curve.mnemonic} ({curve.unit}): {curve.descr}")

df = las.df()
print("\nDataFrame:")
print(df.head())
print("Индекс:", df.index.name)
print("Форма:", df.shape)