import json
import os
from datetime import datetime

# Aici pui logica ta de Playwright/Antigravity care scoate preturile
# Exemplu de format de date care arată bine pe site:
data_to_save = {
    "last_update": datetime.now().strftime("%Y-%m-%d %H:%M"),
    "alerts": [
        {"store": "Competitor 1", "product": "Produs X", "old_price": "150 RON", "new_price": "120 RON", "change": "-20%"},
        {"store": "Competitor 2", "product": "Produs Y", "old_price": "300 RON", "new_price": "350 RON", "change": "+16%"}
    ]
}

# Calea către folderul public al site-ului tău
file_path = os.path.join('public', 'prices.json')

with open(file_path, 'w') as f:
    json.dump(data_to_save, f, indent=4)

print(f"✅ Datele au fost salvate în {file_path}")