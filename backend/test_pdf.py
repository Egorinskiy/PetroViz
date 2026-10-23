"""Изолированный тест PDF-генератора — запускать без БД и API."""
import sys, logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
logging.basicConfig(level=logging.INFO)

import numpy as np
import pandas as pd
from app.export.pdf_builder import build_well_pdf


class FakeWell:
    well_name = "Test Well"
    filename = "test.las"


n = 500
df = pd.DataFrame({
    'GR':   np.random.uniform(20, 120, n),
    'RHOB': np.random.uniform(2.0, 2.7, n),
    'NPHI': np.random.uniform(0.1, 0.4, n),
    'RDEP': np.random.uniform(1, 100, n),
}, index=np.linspace(1000, 1500, n))
df.index.name = 'DEPTH'

pdf = build_well_pdf(
    well=FakeWell(), df=df, computations=[], comp_data={},
    svg_width=900, svg_height=1200,
)

out = Path("test_output.pdf")
out.write_bytes(pdf)
print(f"OK: {out} = {out.stat().st_size:,} bytes")