# scripts/create_dhee_odia.ps1
# Builds and registers dhee-odia model in Ollama once weights are downloaded

Write-Host "Creating dhee-odia model in Ollama..." -ForegroundColor Cyan
ollama create dhee-odia -f Modelfile

Write-Host "`nVerifying installed Ollama models:" -ForegroundColor Green
ollama list
