import json
import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from langchain_groq import ChatGroq as StrategyChatGroq
from browser_use import Agent, Browser, ChatGroq

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

def clean_json_response(content):
    if content.startswith("```json"):
        content = content.split("```json")[1]
    if content.startswith("```"):
        content = content.split("```")[1]
    if content.endswith("```"):
        content = content.rsplit("```", 1)[0]
    return content.strip()

async def process_local_client(client, agent_llm, strategy_llm, browser):
    print(f"--- Procesare Client Local: {client['name']} ---")
    location = client.get('location', 'București')
    keywords = client.get('keywords', ['florărie'])
    keywords_str = ", ".join(keywords)
    platforme = client.get('platforme', ['glovo'])
    platforme_str = ", ".join(platforme)
    
    task = f"""
    Mergi succesiv pe platformele de livrare: {platforme_str}.
    Pentru fiecare platformă:
    Dacă apare un popup de acceptare cookies, acceptă-l.
    Setează locația de livrare la '{location}'.
    Caută succesiv următoarele cuvinte cheie: {keywords_str}.
    Extrage numele, prețul mediu (dacă există, sau un preț orientativ al unui produs) și timpul estimat de livrare pentru primii 5 competitori apăruți în rezultatele fiecărei căutări.
    Returnează datele extrase sub formă de text clar, grupate pe platformă și cuvânt cheie.
    """
    
    agent = Agent(task=task, llm=agent_llm, browser=browser)
    history = await agent.run()
    result_text = history.final_result()
    
    strategy_prompt = f"""
    Ești un expert în strategii comerciale.
    Iată datele extrase de pe platformele {platforme_str} pentru căutările '{keywords_str}' în locația '{location}':
    {result_text}
    
    Folosind aceste date, generează 3 strategii comerciale specifice și acționabile pentru afacerea '{client['name']}' pentru a fi mai competitivă (comparând prețurile și timpul de livrare cu media pieței locale).
    
    Returnează rezultatul STRICT ca un obiect JSON valid, cu următoarea structură:
    {{
      "prices": [
        {{"produs": "Nume competitor", "pret": "Preț mediu", "timp_livrare": "Timp livrare"}}
      ],
      "strategii": [
        "Strategia 1",
        "Strategia 2",
        "Strategia 3"
      ]
    }}
    Asigură-te că nu incluzi niciun alt text, markdown sau explicații în afară de obiectul JSON în sine.
    """
    
    strategy_response = strategy_llm.invoke(strategy_prompt)
    strategy_content = clean_json_response(strategy_response.content.strip())
    
    try:
        final_data = json.loads(strategy_content)
    except json.JSONDecodeError:
        print("Eroare la parsarea JSON-ului. Răspuns brut:", strategy_content)
        final_data = {"prices": [], "strategii": ["Eroare la generare."]}
        
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    for item in final_data.get("prices", []):
        item["data"] = current_time
        
    # Salvează fișierul cu numele clientului, formatat
    filename_base = client.get('id', client['name'].lower().replace(' ', '_'))
    if filename_base.startswith('client_'):
        filename_base = filename_base.replace('client_', '')
    output_file = f"public/data/client_{filename_base}.json"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, mode='w', encoding='utf-8') as file:
        json.dump(final_data, file, indent=4, ensure_ascii=False)
    print(f"Salvat în {output_file}")


async def process_national_client(client, agent_llm, strategy_llm, browser):
    print(f"--- Procesare Client Național: {client['name']} ---")
    targets = client.get('targets', [])
    targets_str = ", ".join(targets)
    keywords = client.get('keywords', ['produs generic'])
    keywords_str = ", ".join(keywords)
    
    task = f"""
    Vizitează succesiv următoarele site-uri de e-commerce: {targets_str}.
    Pentru fiecare site, caută următoarele produse relevante: {keywords_str}.
    Extrage prețurile de listă și verifică dacă stocul este disponibil sau epuizat pentru aceste cuvinte cheie.
    Identifică care este prețul mediu pe fiecare site și dacă există anomalii sau probleme de stoc.
    Returnează un sumar clar cu următoarele pentru fiecare site vizitat: nume sursă, preț mediu estimat, status stoc.
    """
    
    agent = Agent(task=task, llm=agent_llm, browser=browser)
    history = await agent.run()
    result_text = history.final_result()
    
    strategy_prompt = f"""
    Ești un expert în strategii comerciale la nivel național.
    Analizează următoarele date extrase de la competitorii naționali ({targets_str}) pentru produsele '{keywords_str}':
    {result_text}
    
    Identifică 'Liderul de Preț' și 'Media Pieței' la nivel național.
    Sugerează o strategie de preț unitară sau diferențiată pe regiuni/canale, luând în calcul posibile anomalii (de exemplu, lipsa de stoc la anumiți competitori).
    
    Returnează rezultatul STRICT ca un obiect JSON valid, cu următoarea structură:
    {{
      "regiuni": [
        {{"nume_sursa": "Numele site-ului", "pret_mediu_national": "Preț", "stoc_status": "Status"}}
      ],
      "lider_pret": "Numele liderului de preț",
      "media_pietei": "Valoarea medie a pieței",
      "strategii": [
        "Strategia 1",
        "Strategia 2"
      ]
    }}
    Asigură-te că nu incluzi niciun alt text, markdown sau explicații.
    """
    
    strategy_response = strategy_llm.invoke(strategy_prompt)
    strategy_content = clean_json_response(strategy_response.content.strip())
    
    try:
        final_data = json.loads(strategy_content)
    except json.JSONDecodeError:
        print("Eroare la parsarea JSON-ului. Răspuns brut:", strategy_content)
        final_data = {"regiuni": [], "strategii": ["Eroare la generare."]}
        
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    for item in final_data.get("regiuni", []):
        item["timestamp"] = current_time
        
    output_file = "public/data/national_business.json"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, mode='w', encoding='utf-8') as file:
        json.dump(final_data, file, indent=4, ensure_ascii=False)
    print(f"Salvat în {output_file}")


async def run():
    config_path = 'public/config.json'
    if not os.path.exists(config_path):
        print(f"Nu s-a găsit {config_path}")
        return

    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
        
    agent_llm = ChatGroq(model="llama-3.1-8b-instant")
    strategy_llm = StrategyChatGroq(model="llama-3.1-8b-instant")
    is_ci = os.getenv('GITHUB_ACTIONS') == 'true'
    browser = Browser(headless=is_ci)
    
    for client in config.get('clients', []):
        try:
            if client.get('type') == 'local':
                await process_local_client(client, agent_llm, strategy_llm, browser)
            elif client.get('type') == 'national':
                await process_national_client(client, agent_llm, strategy_llm, browser)
        except Exception as e:
            print(f"Eroare la procesarea clientului {client.get('name')}: {e}")
            
    await browser.stop()
    print("Toate sarcinile au fost finalizate.")

if __name__ == '__main__':
    asyncio.run(run())
