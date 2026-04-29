import csv
import asyncio
from playwright.async_api import async_playwright
import os

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
        
        data_to_save = [{'Title': title, 'URL': 'https://example.com'}]
            
        await browser.close()

        # Ne asigurăm că directorul curent este cel corect (sau creăm unul pentru output dacă e nevoie)
        output_file = 'output.csv'

        # Salvăm datele într-un fișier CSV
        with open(output_file, mode='a', newline='', encoding='utf-8') as file:
            # Folosim 'a' pentru append (adăugare), ca să nu suprascriem în fiecare zi, ci să adunăm datele.
            # Dacă fișierul e nou, scriem și header-ul.
            file_exists = os.path.isfile(output_file) and os.path.getsize(output_file) > 0
            writer = csv.DictWriter(file, fieldnames=['Title', 'URL'])
            
            if not file_exists:
                writer.writeheader()
                
            writer.writerows(data_to_save)
            print(f"Date salvate cu succes în {output_file}")

if __name__ == '__main__':
    asyncio.run(run())
