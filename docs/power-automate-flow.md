# Power Automate Flow

Create an instant cloud flow with **When an HTTP request is received** and paste `power-automate-request-schema.json` into the trigger schema.

## Actions

1. Initialize variables for `serialNumber`, `operation`, and an image file name such as:
   `concat(triggerBody()?['serialNumber'], '-', formatDateTime(utcNow(), 'yyyyMMdd-HHmmss'), '.jpg')`
2. Get items from the SharePoint list with filter query:
   `SerialNumber eq '@{triggerBody()?['serialNumber']}'`
3. Add a condition: `length(body('Get_items')?['value']) is greater than 0`.
4. If yes, update the existing item.
5. If no, create a new item.
6. Set operation-specific columns based on `operation`.
7. Respond to the web app with:

```json
{
  "success": true,
  "message": "Saved"
}
```

## Operation Column Mapping

- `MF Stamping` updates `MFStampingDate`, `MFStampingOperator`, `CurrentStatus`.
- `Robot Braze` updates `RobotBrazeDate`, `RobotBrazeOperator`, `JigUsed`, `CurrentStatus`.
- `Ales` updates `AlesDate`, `AlesOperator`, `CurrentStatus`.
- `Paint` updates `PaintDate`, `PaintOperator`, `PaintStatus`, `CurrentStatus`.
- `Final Inspection` updates `FinalInspectionDate`, `FinalInspectionOperator`, `CurrentStatus`.

Always update `LastUpdated` and `Notes`.
Also map `material` and `part` into SharePoint columns so each record can be filtered by frame family and part type.
