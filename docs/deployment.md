# Deployment Steps

## Frontend

1. Create the production environment file:

```bash
cp frontend/.env.example frontend/.env
```

2. Set:
   - `VITE_OCR_API_URL` to the deployed Azure Function OCR endpoint.
   - `VITE_POWER_AUTOMATE_URL` to the Power Automate HTTP trigger URL.
   - `VITE_EMPLOYEE_API_URL` only if employee validation will come from an API.

3. Build and host:

```bash
npm --workspace frontend run build
```

Deploy `frontend/dist` to Azure Static Web Apps, Azure App Service static files, SharePoint static hosting, or another HTTPS host. Camera access requires HTTPS on iPad except for localhost.

## Azure Function

1. Create a Node.js Azure Function App.
2. Add app settings:
   - `AZURE_VISION_ENDPOINT`
   - `AZURE_VISION_KEY`
   - `OCR_ALLOWED_CHARACTERS`
   - `OCR_SERIAL_PATTERN`
   - `OCR_CONFIDENCE_THRESHOLD`
3. Deploy the `azure-function` project.
4. Copy the Function URL into `frontend/.env`.

## Azure Vision

Use Azure AI Vision Image Analysis Read OCR. The frontend never receives the Azure Vision key.

## Power Automate

1. Create the HTTP-triggered flow.
2. Paste `docs/power-automate-request-schema.json` into the trigger.
3. Add SharePoint create-file, get-item, create/update-item, and response actions.
4. Copy the trigger URL into `frontend/.env`.

## iPad Setup

1. Open the deployed frontend URL in Safari.
2. Allow camera permission.
3. Add the page to the Home Screen for an app-like launch.
4. Test one low-confidence OCR case and one manual-correction case before rollout.
