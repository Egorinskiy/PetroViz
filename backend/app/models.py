from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class CurveInfo(BaseModel):
    mnemonic: str
    unit: str
    description: str

class WellMetadata(BaseModel):
    filename: str
    well_name: Optional[str]
    start_depth: float
    stop_depth: float
    step: Optional[float]
    num_samples: int
    curves: List[CurveInfo]

class UploadResponse(BaseModel):
    well_id: str
    metadata: WellMetadata

class CurveDataResponse(BaseModel):
    depth: List[float]
    curves: Dict[str, List[Optional[float]]]