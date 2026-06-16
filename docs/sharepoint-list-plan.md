# SharePoint List Plan

List name: `Frame Traceability`

| Column | Type | Notes |
| --- | --- | --- |
| SerialNumber | Single line text | Indexed, unique if possible |
| Material | Choice | Steel, Titanium |
| Part | Choice | Mainframe, Front Frame, Rear Frame, HBS, HBP |
| BatchNumber | Single line text | From operation form |
| CurrentStatus | Choice | Latest operation name/status |
| MFStampingDate | Date and time | UTC from app |
| MFStampingOperator | Single line text | 4-digit employee ID |
| RobotBrazeDate | Date and time | UTC from app |
| RobotBrazeOperator | Single line text | 4-digit employee ID |
| JigUsed | Single line text | Jig identifier |
| AlesDate | Date and time | UTC from app |
| AlesOperator | Single line text | 4-digit employee ID |
| PaintDate | Date and time | UTC from app |
| PaintOperator | Single line text | 4-digit employee ID |
| PaintStatus | Choice | Pass, Rework, Hold |
| FinalInspectionDate | Date and time | UTC from app |
| FinalInspectionOperator | Single line text | 4-digit employee ID |
| LastUpdated | Date and time | Set every save |
| OCRConfidence | Number | Store 0-1 or percentage consistently |
| ManualCorrection | Yes/No | True when operator changed OCR serial |
| ImageUrl | Hyperlink | Link to document library image |
| Notes | Multiple lines text | Operator notes |

Document library name: `Frame Serial Images`

Recommended image file name:

```text
{SerialNumber}-{OperationId}-{yyyyMMdd-HHmmss}.jpg
```
