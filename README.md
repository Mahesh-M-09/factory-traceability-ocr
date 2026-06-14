# Factory Traceability and Stamped-Frame OCR

Production-minded starter for an iPad operator web app with Azure Vision OCR and SharePoint saving through Power Automate.

## Structure

- `frontend/` - React + Vite + TypeScript operator app.
- `azure-function/` - Node.js Azure Function API for OCR. Azure Vision keys stay here.
- `docs/` - Power Automate schema, SharePoint list plan, and deployment notes.

## Local Setup

```bash
npm install
cp frontend/.env.example frontend/.env
cp azure-function/local.settings.example.json azure-function/local.settings.json
npm run dev
```

The frontend reads editable defaults from `frontend/public/config/app-config.json`. The admin page can export an updated JSON file for replacement in source control or static hosting.

## Security Notes

- Operators do not use Microsoft login; their 4-digit employee ID is validated by config/API.
- Azure Vision credentials are only read by the Azure Function from app settings.
- The Power Automate URL is a frontend environment variable for this first version. Move save calls behind the Azure Function before wider rollout if that URL needs to be hidden.
