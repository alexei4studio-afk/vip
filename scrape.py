import json
import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from browser_use import Agent
from browser_use.browser.browser import Browser, BrowserConfig

load_dotenv()

async def run():
    # Inițializăm modelul Groq (necesită variabila de mediu GROQ_API_KEY)
    llm = ChatGroq(model="llama3-70b-8192")
    
    # Configurăm browser-ul pentru a rula 'headless' (fără UI vizibil)
    browser = Browser(config=BrowserConfig(headless=False)) # Set to False for local testing, can be True for CI
    
    # Definim misiunea agentului pentru navigare
    task = """
    Mergi pe glovoapp.com.
    Dacă apare un popup de acceptare cookies, acceptă-l.
    Setează locația de livrare la 'București'.
    Caută 'florărie'.
    Extrage numele, prețul mediu (dacă există, sau un preț orientativ al unui buchet) și timpul estimat de livrare pentru primii 5 competitori apăruți în rezultate.
    Returnează datele extrase sub formă de text clar.
    """
    
    print("Agentul AI a început navigarea pe Glovo...")
    agent = Agent(
        task=task,
        llm=llm,
        browser=browser
    )
    
    # Rulăm agentul
    history = await agent.run()
    result_text = history.final_result()
    print("Navigare finalizată. Date extrase:")
    print(result_text)
    
    # Pasul 2: Folosim din nou modelul pentru a structura datele și a genera strategii
    strategy_prompt = f"""
    Ești un expert în strategii comerciale.
    Iată datele extrase de pe Glovo pentru florării din București:
    {result_text}
    
    Folosind aceste date, generează 3 strategii comerciale specifice și acționabile pentru afacerea 'paradaflorilor.ro' pentru a fi mai competitivă (comparând prețurile și timpul de livrare cu media pieței locale).
    
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
    
    print("Se generează strategiile comerciale...")
    strategy_response = llm.invoke(strategy_prompt)
    strategy_content = strategy_response.content.strip()
    
    # Curățăm formatul markdown dacă este prezent
    if strategy_content.startswith("```json"):
        strategy_content = strategy_content.split("```json")[1]
    if strategy_content.startswith("```"):
        strategy_content = strategy_content.split("```")[1]
    if strategy_content.endswith("```"):
        strategy_content = strategy_content.rsplit("```", 1)[0]
    strategy_content = strategy_content.strip()
        
    try:
        final_data = json.loads(strategy_content)
    except json.JSONDecodeError as e:
        print("Eroare la parsarea JSON-ului. Răspunsul brut:")
        print(strategy_content)
        final_data = {
            "prices": [],
            "strategii": ["Eroare la generarea strategiilor. Vă rugăm să verificați output-ul brut."]
        }
        
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    for item in final_data.get("prices", []):
        item["data"] = current_time

    await browser.close()
    
    output_file = 'public/prices.json'
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # Suprascriem fișierul pentru ca App.tsx să citească direct final_data
    with open(output_file, mode='w', encoding='utf-8') as file:
        json.dump(final_data, file, indent=4, ensure_ascii=False)
        
    print(f"Date și strategii salvate cu succes în {output_file}")

if __name__ == '__main__':
    asyncio.run(run())
