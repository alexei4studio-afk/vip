import json
import asyncio
from playwright.async_api import async_playwright
import os
from datetime import datetime

async def run():
    async with async_playwright() as p:
        # Lansăm browserul (headless=True înseamnă că nu se va deschide o fereastră vizibilă)
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Navigăm către o pagină generică de exemplu (modifică acest URL cu unul pe care ai voie să îl accesezi)
        await page.goto('https://example.com')
        
        # Așteptăm ca elementul principal să se încarce
        try:
            await page.wait_for_selector('h1', timeout=5000)
        except Exception as e:
            print(f"Eroare la așteptarea selectorului: {e}")

        # Extragem datele folosind selectori CSS
        # Aici va trebui să ajustezi selectorii în funcție de structura paginii pe care o analizezi
        title_element = await page.query_selector('h1')
        title = await title_element.inner_text() if title_element else 'N/A'
        
        data_to_save = [{
            'produs': title,
            'pret': 'N/A', # Trebuie actualizat cu selectorul pentru preț
            'data': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }]
            
        await browser.close()

        # Ne asigurăm că directorul curent este cel corect (sau creăm unul pentru output dacă e nevoie)
        output_file = 'public/prices.json'
        
        # Asigurăm existența folderului 'public'
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        existing_data = []
        # Încercăm să citim datele vechi pentru a adăuga la ele
        if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
            try:
                with open(output_file, mode='r', encoding='utf-8') as file:
                    existing_data = json.load(file)
            except json.JSONDecodeError:
                pass
                
        existing_data.extend(data_to_save)

        # Salvăm datele actualizate într-un fișier JSON
        with open(output_file, mode='w', encoding='utf-8') as file:
            json.dump(existing_data, file, indent=4, ensure_ascii=False)
            
        print(f"Date salvate cu succes în {output_file}")

if __name__ == '__main__':
    asyncio.run(run())
